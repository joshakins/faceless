import { create } from 'zustand';
import { api } from '../lib/api.js';
import { wsClient } from '../lib/ws.js';
import { useAuthStore } from './auth.js';
import { useChatStore } from './chat.js';

interface DmParticipant {
  id: string;
  username: string;
  avatarUrl: string | null;
}

interface ConversationSummary {
  id: string;
  participants: DmParticipant[];
  lastMessage: {
    id: string;
    conversationId: string;
    authorId: string;
    content: string;
    createdAt: number;
  } | null;
  createdAt: number;
}

interface DmMessage {
  id: string;
  conversationId: string;
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  content: string;
  createdAt: number;
  attachment?: { id: string; messageId: string; filename: string; mimeType: string; size: number; url: string } | null;
  gifUrl?: string | null;
}

interface DmState {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  messages: DmMessage[];
  typingUsers: Map<string, { username: string; timeout: ReturnType<typeof setTimeout> }>;

  loadConversations: () => Promise<void>;
  setActiveConversation: (conversationId: string) => Promise<void>;
  openDmWith: (userId: string) => Promise<void>;
  sendMessage: (content: string, file?: File) => Promise<void>;
  sendGif: (gifUrl: string) => void;
  sendTyping: () => void;
  clearActive: () => void;
}

export const useDmStore = create<DmState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  typingUsers: new Map(),

  loadConversations: async () => {
    const { conversations } = await api.getConversations();
    set({ conversations });
  },

  setActiveConversation: async (conversationId) => {
    set({ activeConversationId: conversationId, messages: [], typingUsers: new Map() });
    const { messages } = await api.getDmMessages(conversationId);
    set({ messages });
  },

  openDmWith: async (userId) => {
    // Switch to DM view
    useChatStore.getState().setViewMode('dms');

    // Create or find existing conversation
    const { conversation } = await api.createConversation([userId]);

    // Refresh conversation list
    await get().loadConversations();

    // Navigate to it
    await get().setActiveConversation(conversation.id);
  },

  sendMessage: async (content, file) => {
    const conversationId = get().activeConversationId;
    if (!conversationId || (!content.trim() && !file)) return;

    let attachmentId: string | undefined;
    if (file) {
      const result = await api.uploadFile(file);
      attachmentId = result.id;
    }

    wsClient.send('dm:send', {
      conversationId,
      content: content.trim(),
      attachmentId,
    });
  },

  sendGif: (gifUrl) => {
    const conversationId = get().activeConversationId;
    if (!conversationId || !gifUrl) return;
    wsClient.send('dm:send', { conversationId, content: '', gifUrl });
  },

  sendTyping: () => {
    const conversationId = get().activeConversationId;
    if (!conversationId) return;
    wsClient.send('dm:typing', { conversationId });
  },

  clearActive: () => {
    set({ activeConversationId: null, messages: [], typingUsers: new Map() });
  },
}));

// Helper to get display name for a conversation
export function getConversationDisplayName(
  participants: DmParticipant[],
  currentUserId: string
): string {
  if (participants.length === 1 && participants[0].id === currentUserId) {
    return 'Note to Self';
  }
  const other = participants.find((p) => p.id !== currentUserId);
  return other?.username || 'Unknown User';
}

export function getConversationAvatar(
  participants: DmParticipant[],
  currentUserId: string
): DmParticipant {
  if (participants.length === 1 && participants[0].id === currentUserId) {
    return participants[0];
  }
  return participants.find((p) => p.id !== currentUserId) || participants[0];
}

export function isNoteToSelf(participants: DmParticipant[], currentUserId: string): boolean {
  return participants.length === 1 && participants[0].id === currentUserId;
}

// Listen for real-time DM messages
wsClient.on('dm:new', (data) => {
  const state = useDmStore.getState();

  // If we're viewing this conversation, append the message
  if (data.conversationId === state.activeConversationId) {
    useDmStore.setState({
      messages: [...state.messages, {
        id: data.message.id,
        conversationId: data.message.conversationId,
        authorId: data.message.authorId,
        authorUsername: data.author.username,
        authorAvatarUrl: data.author.avatarUrl,
        content: data.message.content,
        createdAt: data.message.createdAt,
        attachment: data.message.attachment || null,
        gifUrl: data.message.gifUrl || null,
      }],
    });
  }

  // Update conversation list
  const conversations = [...state.conversations];
  const idx = conversations.findIndex((c) => c.id === data.conversationId);
  if (idx >= 0) {
    conversations[idx] = {
      ...conversations[idx],
      lastMessage: {
        id: data.message.id,
        conversationId: data.message.conversationId,
        authorId: data.message.authorId,
        content: data.message.content,
        createdAt: data.message.createdAt,
      },
    };
    // Move to front
    const [conv] = conversations.splice(idx, 1);
    conversations.unshift(conv);
    useDmStore.setState({ conversations });
  } else {
    // New conversation appeared — reload to get full data
    useDmStore.getState().loadConversations();
  }
});

// Listen for DM typing indicators
wsClient.on('dm:typing', (data) => {
  const state = useDmStore.getState();
  if (data.conversationId !== state.activeConversationId) return;

  const typingUsers = new Map(state.typingUsers);
  const existing = typingUsers.get(data.userId);
  if (existing) clearTimeout(existing.timeout);

  const timeout = setTimeout(() => {
    const current = useDmStore.getState();
    const updated = new Map(current.typingUsers);
    updated.delete(data.userId);
    useDmStore.setState({ typingUsers: updated });
  }, 3000);

  typingUsers.set(data.userId, { username: data.username, timeout });
  useDmStore.setState({ typingUsers });
});

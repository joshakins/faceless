import { create } from 'zustand';
import { api } from '../lib/api.js';
import { wsClient } from '../lib/ws.js';

interface ChatAttachment {
  id: string;
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  content: string;
  createdAt: number;
  attachment?: ChatAttachment | null;
  gifUrl?: string | null;
}

interface ChatState {
  viewMode: 'servers' | 'dms';
  activeServerId: string | null;
  activeChannelId: string | null;
  servers: Array<{ id: string; name: string; ownerId: string }>;
  channels: Array<{ id: string; name: string; type: 'text' | 'voice'; serverId: string }>;
  messages: ChatMessage[];
  typingUsers: Map<string, { username: string; timeout: ReturnType<typeof setTimeout> }>;
  setViewMode: (mode: 'servers' | 'dms') => void;
  setActiveServer: (serverId: string) => Promise<void>;
  setActiveChannel: (channelId: string) => Promise<void>;
  loadServers: () => Promise<void>;
  sendMessage: (content: string, file?: File) => Promise<void>;
  sendGif: (gifUrl: string) => void;
  sendTyping: () => void;
  createServer: (name: string) => Promise<void>;
  joinServer: (code: string) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  viewMode: 'servers',
  activeServerId: null,
  activeChannelId: null,
  servers: [],
  channels: [],
  messages: [],
  typingUsers: new Map(),

  setViewMode: (mode) => {
    set({ viewMode: mode });
    if (mode === 'dms') {
      set({ activeServerId: null, activeChannelId: null, channels: [], messages: [] });
    }
  },

  loadServers: async () => {
    const { servers } = await api.getServers();
    set({ servers });
  },

  setActiveServer: async (serverId) => {
    set({ viewMode: 'servers', activeServerId: serverId, activeChannelId: null, messages: [], channels: [] });
    const { channels } = await api.getChannels(serverId);
    set({ channels });
    // Auto-select first text channel
    const firstText = channels.find((c) => c.type === 'text');
    if (firstText) {
      get().setActiveChannel(firstText.id);
    }
  },

  setActiveChannel: async (channelId) => {
    set({ activeChannelId: channelId, messages: [] });
    const { messages } = await api.getMessages(channelId);
    set({ messages });
  },

  sendMessage: async (content, file) => {
    const channelId = get().activeChannelId;
    if (!channelId || (!content.trim() && !file)) return;

    let attachmentId: string | undefined;
    if (file) {
      const result = await api.uploadFile(file);
      attachmentId = result.id;
    }

    wsClient.send('message:send', {
      channelId,
      content: content.trim(),
      attachmentId,
    });
  },

  sendGif: (gifUrl) => {
    const channelId = get().activeChannelId;
    if (!channelId || !gifUrl) return;
    wsClient.send('message:send', { channelId, content: '', gifUrl });
  },

  sendTyping: () => {
    const channelId = get().activeChannelId;
    if (!channelId) return;
    wsClient.send('message:typing', { channelId });
  },

  createServer: async (name) => {
    await api.createServer(name);
    await get().loadServers();
  },

  joinServer: async (code) => {
    await api.joinServer(code);
    await get().loadServers();
  },

  deleteServer: async (serverId) => {
    await api.deleteServer(serverId);
    if (get().activeServerId === serverId) {
      set({ activeServerId: null, activeChannelId: null, channels: [], messages: [] });
    }
    await get().loadServers();
  },
}));

// Listen for real-time messages
wsClient.on('message:new', (data) => {
  const state = useChatStore.getState();
  if (data.message.channelId === state.activeChannelId) {
    useChatStore.setState({
      messages: [...state.messages, {
        id: data.message.id,
        channelId: data.message.channelId,
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
});

// Listen for typing indicators
wsClient.on('message:typing', (data) => {
  const state = useChatStore.getState();
  if (data.channelId !== state.activeChannelId) return;

  const typingUsers = new Map(state.typingUsers);
  const existing = typingUsers.get(data.userId);
  if (existing) clearTimeout(existing.timeout);

  const timeout = setTimeout(() => {
    const current = useChatStore.getState();
    const updated = new Map(current.typingUsers);
    updated.delete(data.userId);
    useChatStore.setState({ typingUsers: updated });
  }, 3000);

  typingUsers.set(data.userId, { username: data.username, timeout });
  useChatStore.setState({ typingUsers });
});

import { create } from 'zustand';
import { api } from '../lib/api.js';
import { wsClient } from '../lib/ws.js';

interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  createdAt: number;
}

interface ChatState {
  activeServerId: string | null;
  activeChannelId: string | null;
  servers: Array<{ id: string; name: string; ownerId: string }>;
  channels: Array<{ id: string; name: string; type: 'text' | 'voice'; serverId: string }>;
  messages: ChatMessage[];
  typingUsers: Map<string, { username: string; timeout: ReturnType<typeof setTimeout> }>;
  setActiveServer: (serverId: string) => Promise<void>;
  setActiveChannel: (channelId: string) => Promise<void>;
  loadServers: () => Promise<void>;
  sendMessage: (content: string) => void;
  sendTyping: () => void;
  createServer: (name: string) => Promise<void>;
  joinServer: (code: string) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeServerId: null,
  activeChannelId: null,
  servers: [],
  channels: [],
  messages: [],
  typingUsers: new Map(),

  loadServers: async () => {
    const { servers } = await api.getServers();
    set({ servers });
  },

  setActiveServer: async (serverId) => {
    set({ activeServerId: serverId, activeChannelId: null, messages: [], channels: [] });
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

  sendMessage: (content) => {
    const channelId = get().activeChannelId;
    if (!channelId || !content.trim()) return;
    wsClient.send('message:send', { channelId, content: content.trim() });
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
        content: data.message.content,
        createdAt: data.message.createdAt,
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

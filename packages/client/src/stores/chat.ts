import { create } from 'zustand';
import { api } from '../lib/api.js';
import { wsClient } from '../lib/ws.js';
import { useAuthStore } from './auth.js';

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
  locked?: boolean;
}

interface ChatState {
  viewMode: 'servers' | 'dms';
  activeServerId: string | null;
  activeChannelId: string | null;
  myRole: 'admin' | 'user' | null;
  servers: Array<{ id: string; name: string; ownerId: string; purgeAfterDays: number }>;
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
  createChannel: (name: string, type: 'text' | 'voice') => Promise<void>;
  deleteChannel: (channelId: string) => Promise<void>;
  updatePurgeSettings: (days: number) => Promise<void>;
  purgeNow: () => Promise<void>;
  toggleMessageLock: (messageId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  viewMode: 'servers',
  activeServerId: null,
  activeChannelId: null,
  myRole: null,
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
    set({ viewMode: 'servers', activeServerId: serverId, activeChannelId: null, messages: [], channels: [], myRole: null });
    const [{ channels }, { members }] = await Promise.all([
      api.getChannels(serverId),
      api.getMembers(serverId),
    ]);
    const userId = useAuthStore.getState().user?.id;
    const me = members.find((m) => m.id === userId);
    set({ channels, myRole: (me?.role as 'admin' | 'user') ?? 'user' });
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

  createChannel: async (name, type) => {
    const serverId = get().activeServerId;
    if (!serverId) return;
    await api.createChannel(serverId, name, type);
  },

  deleteChannel: async (channelId) => {
    await api.deleteChannel(channelId);
  },

  updatePurgeSettings: async (days) => {
    const serverId = get().activeServerId;
    if (!serverId) return;
    await api.updatePurgeSettings(serverId, days);
    set({
      servers: get().servers.map((s) =>
        s.id === serverId ? { ...s, purgeAfterDays: days } : s
      ),
    });
  },

  purgeNow: async () => {
    const serverId = get().activeServerId;
    if (!serverId) return;
    await api.purgeNow(serverId);
    // Keep only locked messages if viewing a text channel in this server
    const activeChannel = get().channels.find((c) => c.id === get().activeChannelId);
    if (activeChannel?.type === 'text') {
      set({ messages: get().messages.filter((m) => m.locked) });
    }
  },

  toggleMessageLock: async (messageId) => {
    await api.toggleMessageLock(messageId);
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

// Listen for message deletions
wsClient.on('message:deleted', (data) => {
  const state = useChatStore.getState();
  if (data.channelId === state.activeChannelId) {
    useChatStore.setState({
      messages: state.messages.filter((m) => m.id !== data.messageId),
    });
  }
});

// Listen for role changes
wsClient.on('member:role-changed', (data) => {
  const state = useChatStore.getState();
  if (data.serverId !== state.activeServerId) return;
  const userId = useAuthStore.getState().user?.id;
  if (data.userId === userId) {
    useChatStore.setState({ myRole: data.role as 'admin' | 'user' });
  }
});

// Listen for member bans (remove from server if it's us)
wsClient.on('member:kicked', (data) => {
  const state = useChatStore.getState();
  // Remove the server from our list
  useChatStore.setState({
    servers: state.servers.filter((s) => s.id !== data.serverId),
  });
  // If we were viewing that server, clear it
  if (state.activeServerId === data.serverId) {
    useChatStore.setState({
      activeServerId: null,
      activeChannelId: null,
      channels: [],
      messages: [],
      myRole: null,
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

// Listen for channel creation
wsClient.on('channel:created', (data) => {
  const state = useChatStore.getState();
  if (data.channel.serverId !== state.activeServerId) return;
  if (state.channels.some((c) => c.id === data.channel.id)) return;
  useChatStore.setState({
    channels: [...state.channels, {
      id: data.channel.id,
      name: data.channel.name,
      type: data.channel.type,
      serverId: data.channel.serverId,
    }],
  });
});

// Listen for channel deletion
wsClient.on('channel:deleted', (data) => {
  const state = useChatStore.getState();
  if (data.serverId !== state.activeServerId) return;
  const newChannels = state.channels.filter((c) => c.id !== data.channelId);

  if (state.activeChannelId === data.channelId) {
    const firstText = newChannels.find((c) => c.type === 'text');
    useChatStore.setState({
      channels: newChannels,
      activeChannelId: firstText?.id ?? null,
      messages: [],
    });
    if (firstText) {
      api.getMessages(firstText.id).then(({ messages }) => {
        useChatStore.setState({ messages });
      });
    }
  } else {
    useChatStore.setState({ channels: newChannels });
  }
});

// Listen for message lock/unlock
wsClient.on('message:locked', (data) => {
  const state = useChatStore.getState();
  if (data.channelId !== state.activeChannelId) return;
  useChatStore.setState({
    messages: state.messages.map((m) =>
      m.id === data.messageId ? { ...m, locked: data.locked } : m
    ),
  });
});

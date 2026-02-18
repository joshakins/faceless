// ── Client → Server ──

export interface ClientEvents {
  'message:send': {
    channelId: string;
    content: string;
    attachmentId?: string;
    gifUrl?: string;
  };
  'message:typing': {
    channelId: string;
  };
  'channel:join': {
    channelId: string;
  };
  'channel:leave': {
    channelId: string;
  };
  'voice:join': {
    channelId: string;
  };
  'voice:leave': {};
  'dm:send': {
    conversationId: string;
    content: string;
    attachmentId?: string;
    gifUrl?: string;
  };
  'dm:typing': {
    conversationId: string;
  };
}

// ── Server → Client ──

export interface ServerEvents {
  'message:new': {
    message: import('./types.js').Message;
    author: import('./types.js').User;
  };
  'message:typing': {
    channelId: string;
    userId: string;
    username: string;
  };
  'presence:update': {
    userId: string;
    status: import('./types.js').PresenceStatus;
    voiceChannelId: string | null;
  };
  'voice:token': {
    token: string;
    url: string;
  };
  'voice:participants': {
    channelId: string;
    participants: string[];
  };
  'dm:new': {
    conversationId: string;
    message: import('./types.js').DirectMessage;
    author: import('./types.js').User;
  };
  'dm:typing': {
    conversationId: string;
    userId: string;
    username: string;
  };
  'error': {
    code: string;
    message: string;
  };
  'member:banned': {
    serverId: string;
    userId: string;
  };
  'member:timeout': {
    serverId: string;
    userId: string;
    timeoutUntil: number;
  };
  'member:role-changed': {
    serverId: string;
    userId: string;
    role: import('./types.js').UserRole;
  };
  'message:deleted': {
    messageId: string;
    channelId: string;
  };
  'member:kicked': {
    serverId: string;
    reason: string;
  };
}

// ── Envelope ──

export type ClientEventName = keyof ClientEvents;
export type ServerEventName = keyof ServerEvents;

export interface WsMessage<T = unknown> {
  event: string;
  data: T;
  id?: string;
}

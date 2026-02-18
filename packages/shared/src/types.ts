export interface User {
  id: string;
  username: string;
  avatarUrl: string | null;
  createdAt: number;
}

export interface Server {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
}

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: 'text' | 'voice';
  createdAt: number;
}

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: number;
  attachment?: Attachment | null;
  gifUrl?: string | null;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  authorId: string;
  content: string;
  createdAt: number;
  attachment?: Attachment | null;
  gifUrl?: string | null;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  createdAt: number;
}

export interface ConversationWithParticipants {
  id: string;
  participants: User[];
  lastMessage: DirectMessage | null;
  createdAt: number;
}

export interface InviteCode {
  code: string;
  serverId: string;
  createdBy: string;
  usesRemaining: number | null;
  expiresAt: number | null;
  createdAt: number;
}

export type PresenceStatus = 'online' | 'offline' | 'in-voice';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  voiceChannelId: string | null;
}

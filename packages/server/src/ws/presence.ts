import type { PresenceStatus, UserPresence } from '@faceless/shared';

class PresenceTracker {
  private presence = new Map<string, UserPresence>();

  setOnline(userId: string): void {
    this.presence.set(userId, {
      userId,
      status: 'online',
      voiceChannelId: null,
    });
  }

  setOffline(userId: string): void {
    this.presence.delete(userId);
  }

  setInVoice(userId: string, channelId: string): void {
    this.presence.set(userId, {
      userId,
      status: 'in-voice',
      voiceChannelId: channelId,
    });
  }

  leaveVoice(userId: string): void {
    const current = this.presence.get(userId);
    if (current) {
      current.status = 'online';
      current.voiceChannelId = null;
    }
  }

  getStatus(userId: string): PresenceStatus {
    return this.presence.get(userId)?.status ?? 'offline';
  }

  getPresence(userId: string): UserPresence {
    return this.presence.get(userId) ?? {
      userId,
      status: 'offline',
      voiceChannelId: null,
    };
  }

  getAllOnline(): UserPresence[] {
    return Array.from(this.presence.values());
  }
}

export const presenceTracker = new PresenceTracker();

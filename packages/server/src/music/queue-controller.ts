import { nanoid } from 'nanoid';
import type { MusicPlayerState, MusicTrack } from '@faceless/shared';
import type { ChannelMusicSession } from './types.js';
import { resolveTrackInfo } from './audio-pipeline.js';
import { broadcastToChannel, sendToUser } from '../ws/handler.js';

const AUTO_LEAVE_MS = 5 * 60 * 1000;
const TRACK_END_GRACE_MS = 10_000;

class QueueController {
  private sessions = new Map<string, ChannelMusicSession>();

  async play(
    channelId: string,
    serverId: string,
    url: string,
    userId: string,
    username: string,
  ): Promise<void> {
    let info;
    try {
      info = await resolveTrackInfo(url);
    } catch (err) {
      sendToUser(userId, 'music:error', {
        channelId,
        message: `Could not resolve URL: ${(err as Error).message}`,
      });
      return;
    }

    const track: MusicTrack = {
      id: nanoid(),
      url: info.streamUrl,
      title: info.title,
      duration: info.duration,
      requestedBy: userId,
      requestedByUsername: username,
    };

    console.info(`[Melody] Resolved "${track.title}" (${Math.round(track.duration)}s) for channel ${channelId}`);

    const session = this.getOrCreateSession(channelId, serverId);
    this.clearAutoLeave(session);

    if (session.currentTrack) {
      session.queue.push(track);
      this.broadcastState(session);
      return;
    }

    this.startTrack(session, track);
  }

  skip(channelId: string): void {
    const session = this.sessions.get(channelId);
    if (!session) return;
    this.advanceQueue(session);
  }

  stop(channelId: string): void {
    const session = this.sessions.get(channelId);
    if (!session) return;

    this.clearAdvanceTimer(session);
    session.currentTrack = null;
    session.queue = [];
    session.isPlaying = false;
    session.startedAtMs = 0;
    session.pausedAtMs = 0;
    this.broadcastState(session);
    this.resetAutoLeave(session);
  }

  pause(channelId: string): boolean {
    const session = this.sessions.get(channelId);
    if (!session || !session.isPlaying || !session.currentTrack) return false;

    this.clearAdvanceTimer(session);
    session.isPlaying = false;
    session.pausedAtMs = Date.now();
    this.broadcastState(session);
    return true;
  }

  resume(channelId: string): boolean {
    const session = this.sessions.get(channelId);
    if (!session || session.isPlaying || !session.currentTrack) return false;

    const pausedDuration = Date.now() - session.pausedAtMs;
    session.startedAtMs += pausedDuration;
    session.isPlaying = true;
    session.pausedAtMs = 0;
    this.scheduleFallbackAdvance(session);
    this.broadcastState(session);
    return true;
  }

  trackEnded(channelId: string, trackId: string): void {
    const session = this.sessions.get(channelId);
    if (!session || session.currentTrack?.id !== trackId) return;
    this.advanceQueue(session);
  }

  getState(channelId: string): MusicPlayerState | null {
    const session = this.sessions.get(channelId);
    if (!session) return null;
    return this.buildState(session);
  }

  async shutdownAll(): Promise<void> {
    for (const [channelId, session] of this.sessions) {
      this.clearAdvanceTimer(session);
      this.clearAutoLeave(session);
      this.sessions.delete(channelId);
    }
  }

  getCurrentTrackRequester(channelId: string): string | null {
    const session = this.sessions.get(channelId);
    return session?.currentTrack?.requestedBy ?? null;
  }

  getTrackStream(trackId: string): { streamUrl: string; channelId: string; serverId: string } | null {
    for (const session of this.sessions.values()) {
      if (session.currentTrack?.id === trackId) {
        return {
          streamUrl: session.currentTrack.url,
          channelId: session.channelId,
          serverId: session.serverId,
        };
      }

      const queuedTrack = session.queue.find((track) => track.id === trackId);
      if (queuedTrack) {
        return {
          streamUrl: queuedTrack.url,
          channelId: session.channelId,
          serverId: session.serverId,
        };
      }
    }

    return null;
  }

  private getOrCreateSession(channelId: string, serverId: string): ChannelMusicSession {
    let session = this.sessions.get(channelId);
    if (session) return session;

    session = {
      channelId,
      serverId,
      queue: [],
      currentTrack: null,
      isPlaying: false,
      startedAtMs: 0,
      pausedAtMs: 0,
      autoLeaveTimer: null,
      advanceTimer: null,
    };
    this.sessions.set(channelId, session);
    return session;
  }

  private startTrack(session: ChannelMusicSession, track: MusicTrack): void {
    this.clearAdvanceTimer(session);
    session.currentTrack = track;
    session.isPlaying = true;
    session.startedAtMs = Date.now();
    session.pausedAtMs = 0;
    this.scheduleFallbackAdvance(session);
    this.broadcastState(session);
  }

  private advanceQueue(session: ChannelMusicSession): void {
    this.clearAdvanceTimer(session);
    const next = session.queue.shift();
    if (next) {
      this.startTrack(session, next);
      return;
    }

    session.currentTrack = null;
    session.isPlaying = false;
    session.startedAtMs = 0;
    session.pausedAtMs = 0;
    this.broadcastState(session);
    this.resetAutoLeave(session);
  }

  private scheduleFallbackAdvance(session: ChannelMusicSession): void {
    this.clearAdvanceTimer(session);
    if (!session.currentTrack?.duration) return;

    const elapsedMs = Math.max(0, Date.now() - session.startedAtMs);
    const remainingMs = Math.max(1_000, session.currentTrack.duration * 1000 - elapsedMs + TRACK_END_GRACE_MS);
    session.advanceTimer = setTimeout(() => {
      this.advanceQueue(session);
    }, remainingMs);
  }

  private clearAdvanceTimer(session: ChannelMusicSession): void {
    if (session.advanceTimer) {
      clearTimeout(session.advanceTimer);
      session.advanceTimer = null;
    }
  }

  private clearAutoLeave(session: ChannelMusicSession): void {
    if (session.autoLeaveTimer) {
      clearTimeout(session.autoLeaveTimer);
      session.autoLeaveTimer = null;
    }
  }

  private broadcastState(session: ChannelMusicSession): void {
    broadcastToChannel(session.channelId, 'music:state', { state: this.buildState(session) });
  }

  private buildState(session: ChannelMusicSession): MusicPlayerState {
    let positionMs = 0;
    if (session.currentTrack && session.startedAtMs) {
      positionMs = session.isPlaying
        ? Date.now() - session.startedAtMs
        : session.pausedAtMs - session.startedAtMs;
    }

    return {
      channelId: session.channelId,
      currentTrack: session.currentTrack,
      queue: [...session.queue],
      isPlaying: session.isPlaying,
      positionMs,
      positionUpdatedAt: Date.now(),
    };
  }

  private resetAutoLeave(session: ChannelMusicSession): void {
    this.clearAutoLeave(session);
    session.autoLeaveTimer = setTimeout(() => {
      this.sessions.delete(session.channelId);
    }, AUTO_LEAVE_MS);
  }
}

export const queueController = new QueueController();

import { Room, AudioSource, LocalAudioTrack, AudioFrame, TrackSource, TrackPublishOptions } from '@livekit/rtc-node';
import { AccessToken } from 'livekit-server-sdk';
import { nanoid } from 'nanoid';
import type { MusicTrack, MusicPlayerState } from '@faceless/shared';
import type { ChannelMusicSession } from './types.js';
import {
  resolveTrackInfo,
  createAudioPipeline,
  SAMPLE_RATE,
  NUM_CHANNELS,
  SAMPLES_PER_FRAME,
  BYTES_PER_FRAME,
} from './audio-pipeline.js';
import { broadcastToChannel, sendToUser } from '../ws/handler.js';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'devsecretdevsecretdevsecret12345';
const LIVEKIT_PORT = process.env.LIVEKIT_PORT || '7880';
const LIVEKIT_URL = process.env.LIVEKIT_URL || '';

const AUTO_LEAVE_MS = 5 * 60 * 1000; // 5 minutes
const SILENCE_FRAME = new Int16Array(SAMPLES_PER_FRAME); // all zeros = silence

function getLivekitUrl(): string {
  if (LIVEKIT_URL) return LIVEKIT_URL;
  return `ws://localhost:${LIVEKIT_PORT}`;
}

class QueueController {
  private sessions = new Map<string, ChannelMusicSession>();

  async play(
    channelId: string,
    serverId: string,
    url: string,
    userId: string,
    username: string,
  ): Promise<void> {
    // Resolve track metadata
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

    let session = this.sessions.get(channelId);

    // Join room if no session exists
    if (!session) {
      try {
        session = await this.joinRoom(channelId, serverId);
      } catch (err) {
        sendToUser(userId, 'music:error', {
          channelId,
          message: `Could not join voice channel: ${(err as Error).message}`,
        });
        return;
      }
    }

    // Clear auto-leave timer since we have a new track
    if (session.autoLeaveTimer) {
      clearTimeout(session.autoLeaveTimer);
      session.autoLeaveTimer = null;
    }

    if (session.currentTrack) {
      // Something is already playing — add to queue
      session.queue.push(track);
      this.broadcastState(session);
    } else {
      // Nothing playing — start immediately
      session.currentTrack = track;
      session.isPlaying = true;
      session.startedAtMs = Date.now();
      this.broadcastState(session);
      this.startStreaming(session);
    }
  }

  skip(channelId: string): void {
    const session = this.sessions.get(channelId);
    if (!session) return;

    this.cleanupPipeline(session);
    this.advanceQueue(session);
  }

  stop(channelId: string): void {
    const session = this.sessions.get(channelId);
    if (!session) return;

    // Set streamGeneration to invalidate any in-flight stream event handlers
    session.streamGeneration++;
    this.cleanupPipeline(session);

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

    session.isPlaying = false;
    session.pausedAtMs = Date.now();
    // Stream keeps running but startStreaming's data handler sends silence when !isPlaying

    this.broadcastState(session);
    return true;
  }

  resume(channelId: string): boolean {
    const session = this.sessions.get(channelId);
    if (!session || session.isPlaying || !session.currentTrack) return false;

    // Adjust startedAtMs to account for paused duration
    const pausedDuration = Date.now() - session.pausedAtMs;
    session.startedAtMs += pausedDuration;
    session.isPlaying = true;
    session.pausedAtMs = 0;

    this.broadcastState(session);
    return true;
  }

  getState(channelId: string): MusicPlayerState | null {
    const session = this.sessions.get(channelId);
    if (!session) return null;
    return this.buildState(session);
  }

  async shutdownAll(): Promise<void> {
    for (const [channelId, session] of this.sessions) {
      this.cleanupPipeline(session);
      if (session.autoLeaveTimer) {
        clearTimeout(session.autoLeaveTimer);
      }
      try {
        await session.audioTrack.close();
        await session.audioSource.close();
        await session.room.disconnect();
      } catch {}
      this.sessions.delete(channelId);
    }
  }

  getCurrentTrackRequester(channelId: string): string | null {
    const session = this.sessions.get(channelId);
    return session?.currentTrack?.requestedBy ?? null;
  }

  // ── Private ──

  private cleanupPipeline(session: ChannelMusicSession): void {
    if (session.pipeline) {
      session.pipeline.cleanup();
      session.pipeline = null;
    }
  }

  private async joinRoom(channelId: string, serverId: string): Promise<ChannelMusicSession> {
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: 'melody-bot',
      name: 'Melody',
    });

    token.addGrant({
      room: channelId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: false,
    });

    const jwt = await token.toJwt();
    const url = getLivekitUrl();

    const room = new Room();
    await room.connect(url, jwt, { autoSubscribe: false, dynacast: false });

    const audioSource = new AudioSource(SAMPLE_RATE, NUM_CHANNELS);
    const audioTrack = LocalAudioTrack.createAudioTrack('melody-audio', audioSource);

    const publishOptions = new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE });
    await room.localParticipant!.publishTrack(audioTrack, publishOptions);

    const session: ChannelMusicSession = {
      channelId,
      serverId,
      room,
      audioSource,
      audioTrack,
      pipeline: null,
      queue: [],
      currentTrack: null,
      isPlaying: false,
      startedAtMs: 0,
      pausedAtMs: 0,
      autoLeaveTimer: null,
      streamGeneration: 0,
    };

    this.sessions.set(channelId, session);
    return session;
  }

  private startStreaming(session: ChannelMusicSession): void {
    if (!session.currentTrack) return;

    const pipeline = createAudioPipeline(session.currentTrack.url);
    session.pipeline = pipeline;

    // Capture the generation at the time this stream starts.
    // If stop() increments the generation, our event handlers become no-ops.
    const gen = ++session.streamGeneration;

    let buffer = Buffer.alloc(0);

    pipeline.pcmStream.on('data', (chunk: Buffer) => {
      if (gen !== session.streamGeneration) return;

      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= BYTES_PER_FRAME) {
        const frameData = buffer.subarray(0, BYTES_PER_FRAME);
        buffer = buffer.subarray(BYTES_PER_FRAME);

        if (!session.isPlaying) {
          // Paused — send silence to keep the audio track alive
          const frame = new AudioFrame(SILENCE_FRAME, SAMPLE_RATE, NUM_CHANNELS, SAMPLES_PER_FRAME);
          session.audioSource.captureFrame(frame).catch(() => {});
          continue;
        }

        // Copy the PCM data to avoid sharing the underlying buffer with
        // captureFrame's async processing
        const int16Copy = new Int16Array(SAMPLES_PER_FRAME);
        const view = new Int16Array(frameData.buffer, frameData.byteOffset, SAMPLES_PER_FRAME);
        int16Copy.set(view);

        const frame = new AudioFrame(int16Copy, SAMPLE_RATE, NUM_CHANNELS, SAMPLES_PER_FRAME);
        session.audioSource.captureFrame(frame).catch(() => {
          // Source may be closed during skip/stop — ignore
        });
      }
    });

    pipeline.pcmStream.on('end', () => {
      if (gen !== session.streamGeneration) return;
      this.cleanupPipeline(session);
      this.advanceQueue(session);
    });

    pipeline.pcmStream.on('error', () => {
      if (gen !== session.streamGeneration) return;
      this.cleanupPipeline(session);
      this.advanceQueue(session);
    });

    pipeline.ffmpegProcess.on('close', () => {
      if (gen !== session.streamGeneration) return;
      // If the process closed but we haven't handled it via stream events,
      // treat it as stream end
      if (session.pipeline === pipeline) {
        session.pipeline = null;
        this.advanceQueue(session);
      }
    });
  }

  private advanceQueue(session: ChannelMusicSession): void {
    const next = session.queue.shift();
    if (next) {
      session.currentTrack = next;
      session.isPlaying = true;
      session.startedAtMs = Date.now();
      session.pausedAtMs = 0;
      this.broadcastState(session);
      this.startStreaming(session);
    } else {
      session.currentTrack = null;
      session.isPlaying = false;
      session.startedAtMs = 0;
      session.pausedAtMs = 0;
      this.broadcastState(session);
      this.resetAutoLeave(session);
    }
  }

  private broadcastState(session: ChannelMusicSession): void {
    const state = this.buildState(session);
    broadcastToChannel(session.channelId, 'music:state', { state });
  }

  private buildState(session: ChannelMusicSession): MusicPlayerState {
    let positionMs = 0;
    if (session.currentTrack && session.startedAtMs) {
      if (session.isPlaying) {
        positionMs = Date.now() - session.startedAtMs;
      } else if (session.pausedAtMs) {
        positionMs = session.pausedAtMs - session.startedAtMs;
      }
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
    if (session.autoLeaveTimer) {
      clearTimeout(session.autoLeaveTimer);
    }
    session.autoLeaveTimer = setTimeout(() => {
      this.leaveChannel(session.channelId);
    }, AUTO_LEAVE_MS);
  }

  private async leaveChannel(channelId: string): Promise<void> {
    const session = this.sessions.get(channelId);
    if (!session) return;

    session.streamGeneration++;
    this.cleanupPipeline(session);
    if (session.autoLeaveTimer) {
      clearTimeout(session.autoLeaveTimer);
    }

    try {
      await session.audioTrack.close();
      await session.audioSource.close();
      await session.room.disconnect();
    } catch {}

    this.sessions.delete(channelId);
  }
}

export const queueController = new QueueController();

import type { ChildProcess } from 'child_process';
import type { Readable } from 'stream';
import type { Room, AudioSource, LocalAudioTrack } from '@livekit/rtc-node';
import type { MusicTrack } from '@faceless/shared';

export interface AudioPipeline {
  ffmpegProcess: ChildProcess;
  pcmStream: Readable;
  cleanup: () => void;
}

export interface ChannelMusicSession {
  channelId: string;
  serverId: string;
  room: Room;
  audioSource: AudioSource;
  audioTrack: LocalAudioTrack;
  pipeline: AudioPipeline | null;
  queue: MusicTrack[];
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  startedAtMs: number;
  pausedAtMs: number;
  autoLeaveTimer: ReturnType<typeof setTimeout> | null;
  streamGeneration: number;
}

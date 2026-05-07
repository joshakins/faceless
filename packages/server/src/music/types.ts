import type { MusicTrack } from '@faceless/shared';
import type { ChildProcess } from 'child_process';
import type { Readable } from 'stream';

export interface AudioPipeline {
  ffmpegProcess: ChildProcess;
  pcmStream: Readable;
  cleanup: () => void;
}

export interface ChannelMusicSession {
  channelId: string;
  serverId: string;
  queue: MusicTrack[];
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  startedAtMs: number;
  pausedAtMs: number;
  autoLeaveTimer: ReturnType<typeof setTimeout> | null;
  advanceTimer: ReturnType<typeof setTimeout> | null;
}

import { spawn } from 'child_process';
import type { AudioPipeline } from './types.js';

const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

const YTDLP_TIMEOUT_MS = 30_000;

export const SAMPLE_RATE = 48000;
export const NUM_CHANNELS = 1;
export const FRAME_DURATION_MS = 20;
export const SAMPLES_PER_FRAME = (SAMPLE_RATE * FRAME_DURATION_MS) / 1000; // 960
export const BYTES_PER_FRAME = SAMPLES_PER_FRAME * 2; // 1920 (s16le = 2 bytes per sample)

export interface TrackInfo {
  title: string;
  duration: number;
  streamUrl: string;
}

/**
 * Resolve a URL via yt-dlp to get metadata and a direct stream URL.
 * Supports YouTube, SoundCloud, and any yt-dlp-supported site.
 * If the input looks like a search string (not a URL), uses ytsearch:.
 */
export function resolveTrackInfo(url: string): Promise<TrackInfo> {
  return new Promise((resolve, reject) => {
    const isUrl = url.startsWith('http://') || url.startsWith('https://');
    const query = isUrl ? url : `ytsearch:${url}`;
    let settled = false;

    const proc = spawn(YTDLP_PATH, [
      '--print', 'title',
      '--print', 'duration',
      '--get-url',
      '--format', 'bestaudio',
      '--no-playlist',
      query,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { proc.kill('SIGKILL'); } catch {}
        reject(new Error('yt-dlp timed out'));
      }
    }, YTDLP_TIMEOUT_MS);

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;

      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr.trim()}`));
        return;
      }

      const lines = stdout.trim().split('\n');
      if (lines.length < 3) {
        reject(new Error('yt-dlp returned unexpected output'));
        return;
      }

      const title = lines[0];
      const duration = parseFloat(lines[1]) || 0;
      const streamUrl = lines[2];

      resolve({ title, duration, streamUrl });
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });
}

/**
 * Create an FFmpeg audio pipeline that transcodes the given stream URL
 * to raw PCM (s16le, 48kHz, mono) suitable for LiveKit AudioSource.
 */
export function createAudioPipeline(streamUrl: string): AudioPipeline {
  let cleaned = false;

  const ffmpegProcess = spawn(FFMPEG_PATH, [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', streamUrl,
    '-f', 's16le',
    '-ar', String(SAMPLE_RATE),
    '-ac', String(NUM_CHANNELS),
    '-loglevel', 'error',
    '-',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const pcmStream = ffmpegProcess.stdout!;

  // Log FFmpeg errors for debugging
  ffmpegProcess.stderr!.on('data', (chunk: Buffer) => {
    console.error(`[Melody FFmpeg] ${chunk.toString().trim()}`);
  });

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try { pcmStream.removeAllListeners(); } catch {}
    try { pcmStream.destroy(); } catch {}
    try { ffmpegProcess.kill('SIGKILL'); } catch {}
  };

  // Auto-cleanup on process exit
  ffmpegProcess.on('close', () => {
    cleaned = true;
  });

  return { ffmpegProcess, pcmStream, cleanup };
}

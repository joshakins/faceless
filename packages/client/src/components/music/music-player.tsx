import { useEffect, useRef, useState } from 'react';
import { useMusicStore } from '../../stores/music.js';
import { MusicQueue } from './music-queue.js';

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface MusicPlayerProps {
  channelId: string;
}

export function MusicPlayer({ channelId }: MusicPlayerProps) {
  const playerState = useMusicStore((s) => s.playerState);
  const getPositionMs = useMusicStore((s) => s.getPositionMs);
  const pause = useMusicStore((s) => s.pause);
  const resume = useMusicStore((s) => s.resume);
  const skip = useMusicStore((s) => s.skip);
  const stop = useMusicStore((s) => s.stop);
  const [positionMs, setPositionMs] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const rafRef = useRef<number>(0);

  // Update position via requestAnimationFrame
  useEffect(() => {
    if (!playerState?.isPlaying) {
      setPositionMs(getPositionMs());
      return;
    }

    const tick = () => {
      setPositionMs(getPositionMs());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [playerState?.isPlaying, playerState?.positionUpdatedAt, getPositionMs]);

  if (!playerState || playerState.channelId !== channelId || !playerState.currentTrack) {
    return null;
  }

  const { currentTrack, isPlaying, queue } = playerState;
  const durationMs = currentTrack.duration * 1000;
  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;

  return (
    <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 shrink-0">
      <div className="flex items-center gap-3">
        {/* Track info */}
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium truncate">{currentTrack.title}</div>
          <div className="text-gray-400 text-xs truncate">
            Requested by {currentTrack.requestedByUsername}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => isPlaying ? pause(channelId) : resume(channelId)}
            className="px-2.5 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            {isPlaying ? 'Pause' : 'Resume'}
          </button>

          <button
            onClick={() => skip(channelId)}
            className="px-2.5 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Skip
          </button>

          <button
            onClick={() => stop(channelId)}
            className="px-2.5 py-1 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Stop
          </button>

          {/* Queue badge */}
          <div className="relative">
            <button
              onClick={() => setShowQueue(!showQueue)}
              className="px-2.5 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Queue {queue.length > 0 && `(${queue.length})`}
            </button>
            {showQueue && (
              <MusicQueue queue={queue} onClose={() => setShowQueue(false)} />
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {durationMs > 0 && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-gray-500 text-xs w-10 text-right">{formatTime(positionMs)}</span>
          <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-none"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="text-gray-500 text-xs w-10">{formatTime(durationMs)}</span>
        </div>
      )}
    </div>
  );
}

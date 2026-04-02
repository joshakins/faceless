import type { MusicTrack } from '@faceless/shared';

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface MusicQueueProps {
  queue: MusicTrack[];
  onClose: () => void;
}

export function MusicQueue({ queue, onClose }: MusicQueueProps) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-10" onClick={onClose} />

      {/* Dropdown */}
      <div className="absolute bottom-full right-0 mb-2 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto">
        <div className="p-3">
          <div className="text-gray-300 text-xs font-semibold mb-2">
            Up Next ({queue.length})
          </div>

          {queue.length === 0 ? (
            <div className="text-gray-500 text-xs py-2">Queue is empty</div>
          ) : (
            <div className="space-y-1.5">
              {queue.map((track, i) => (
                <div key={track.id} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-600 w-4 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-300 truncate">{track.title}</div>
                    <div className="text-gray-500 truncate">
                      {track.requestedByUsername} &middot; {formatDuration(track.duration)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

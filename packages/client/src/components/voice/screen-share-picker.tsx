import { useState, useEffect } from 'react';

interface ScreenSharePickerProps {
  onSelect: (sourceId: string) => void;
  onClose: () => void;
}

export function ScreenSharePicker({ onSelect, onClose }: ScreenSharePickerProps) {
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.faceless.getDesktopSources().then((results) => {
      setSources(results);
      setLoading(false);
    });
  }, []);

  const screens = sources.filter((s) => s.id.startsWith('screen:'));
  const windows = sources.filter((s) => s.id.startsWith('window:'));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-lg p-6 w-[640px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-4">Share Your Screen</h2>

        {loading ? (
          <div className="text-gray-400 text-center py-8">Loading sources...</div>
        ) : (
          <>
            {screens.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Screens</h3>
                <div className="grid grid-cols-2 gap-3">
                  {screens.map((source) => (
                    <button
                      key={source.id}
                      onClick={() => onSelect(source.id)}
                      className="rounded-lg border-2 border-gray-700 hover:border-indigo-500 overflow-hidden transition-colors text-left"
                    >
                      <img src={source.thumbnailDataUrl} alt={source.name} className="w-full aspect-video object-cover" />
                      <div className="px-2 py-1.5 text-xs text-gray-300 truncate">{source.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {windows.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Windows</h3>
                <div className="grid grid-cols-2 gap-3">
                  {windows.map((source) => (
                    <button
                      key={source.id}
                      onClick={() => onSelect(source.id)}
                      className="rounded-lg border-2 border-gray-700 hover:border-indigo-500 overflow-hidden transition-colors text-left"
                    >
                      <img src={source.thumbnailDataUrl} alt={source.name} className="w-full aspect-video object-cover" />
                      <div className="px-2 py-1.5 text-xs text-gray-300 truncate flex items-center gap-1.5">
                        {source.appIconDataUrl && <img src={source.appIconDataUrl} className="w-4 h-4" alt="" />}
                        {source.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

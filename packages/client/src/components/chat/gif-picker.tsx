import { useState, useEffect, useRef, useCallback } from 'react';
import { api, type KlipyGif } from '../../lib/api.js';
import { useChatStore } from '../../stores/chat.js';

interface GifPickerProps {
  onClose: () => void;
}

export function GifPicker({ onClose }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<KlipyGif[]>([]);
  const [loading, setLoading] = useState(true);
  const sendGif = useChatStore((s) => s.sendGif);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const panelRef = useRef<HTMLDivElement>(null);

  // Load trending on mount
  useEffect(() => {
    setLoading(true);
    api.gifTrending().then((res) => {
      if (res.result) setGifs(res.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setLoading(true);
      api.gifTrending().then((res) => {
        if (res.result) setGifs(res.data.data);
        setLoading(false);
      }).catch(() => setLoading(false));
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      api.gifSearch(query).then((res) => {
        if (res.result) setGifs(res.data.data);
        setLoading(false);
      }).catch(() => setLoading(false));
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSelect = useCallback((gif: KlipyGif) => {
    const url = gif.file.md?.webp?.url || gif.file.sm?.webp?.url || gif.file.sm?.gif?.url;
    if (url) {
      sendGif(url);
      onClose();
    }
  }, [sendGif, onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full mb-2 left-0 w-[400px] h-[360px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl flex flex-col overflow-hidden z-50"
    >
      <div className="p-2 border-b border-gray-700">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs..."
          className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
          autoFocus
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
        ) : gifs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">No GIFs found</div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => handleSelect(gif)}
                className="relative rounded overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all aspect-video bg-gray-900"
              >
                <img
                  src={gif.file.sm?.webp?.url || gif.file.xs?.gif?.url}
                  alt={gif.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-2 py-1 border-t border-gray-700 text-center">
        <span className="text-xs text-gray-500">Powered by Klipy</span>
      </div>
    </div>
  );
}

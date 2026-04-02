import { useState, useRef, useEffect } from 'react';
import { useMusicStore } from '../../stores/music.js';

interface PlayInputProps {
  channelId: string;
  onClose: () => void;
}

export function PlayInput({ channelId, onClose }: PlayInputProps) {
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const play = useMusicStore((s) => s.play);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    play(channelId, trimmed);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-10" onClick={onClose} />

      {/* Input overlay */}
      <div className="absolute bottom-full left-0 mb-2 z-20">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL or search query..."
            className="w-72 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors"
          >
            Play
          </button>
        </form>
      </div>
    </>
  );
}

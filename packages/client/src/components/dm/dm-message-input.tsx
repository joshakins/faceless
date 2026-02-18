import { useState, useRef, useCallback } from 'react';
import { useDmStore } from '../../stores/dm.js';
import { GifPicker } from '../chat/gif-picker.js';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export function DmMessageInput() {
  const [text, setText] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const sendMessage = useDmStore((s) => s.sendMessage);
  const sendTyping = useDmStore((s) => s.sendTyping);
  const typingThrottleRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const stageFile = useCallback((file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) return;
    if (file.size > MAX_SIZE) return;
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const clearFile = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setPreviewUrl(null);
  }, [previewUrl]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file' && ALLOWED_TYPES.includes(item.type)) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          stageFile(file);
          return;
        }
      }
    }
  }, [stageFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) stageFile(file);
    e.target.value = '';
  }, [stageFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !pendingFile) return;
    setUploading(true);
    try {
      await sendMessage(text, pendingFile || undefined);
      setText('');
      clearFile();
    } finally {
      setUploading(false);
      textInputRef.current?.focus();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    const now = Date.now();
    if (now - typingThrottleRef.current > 2000) {
      typingThrottleRef.current = now;
      sendTyping();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 shrink-0">
      {previewUrl && (
        <div className="mb-2 relative inline-block">
          <img
            src={previewUrl}
            alt="Attachment preview"
            className="max-h-32 rounded border border-gray-600"
          />
          <button
            type="button"
            onClick={clearFile}
            className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
          >
            &times;
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-600 transition-colors"
          title="Upload image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="relative">
          <button
            type="button"
            onClick={() => setGifPickerOpen((prev) => !prev)}
            className="text-gray-400 hover:text-white px-1.5 py-1 rounded hover:bg-gray-600 transition-colors text-xs font-bold"
            title="Send a GIF"
          >
            GIF
          </button>
          {gifPickerOpen && (
            <GifPicker onClose={() => setGifPickerOpen(false)} onSendGif={(url) => useDmStore.getState().sendGif(url)} />
          )}
        </div>

        <input
          ref={textInputRef}
          type="text"
          value={text}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder={uploading ? 'Sending...' : 'Type a message...'}
          disabled={uploading}
          className="flex-1 px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          autoFocus
        />
      </div>
    </form>
  );
}

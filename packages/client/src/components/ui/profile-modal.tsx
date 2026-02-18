import { useState, useRef } from 'react';
import { useAuthStore } from '../../stores/auth.js';
import { UserAvatar } from './user-avatar.js';

interface ProfileModalProps {
  onClose: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const user = useAuthStore((s) => s.user);
  const updateAvatar = useAuthStore((s) => s.updateAvatar);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploading(true);
    try {
      await updateAvatar(file);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-80" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">Profile</h2>

        <div className="flex flex-col items-center gap-4 mb-6">
          <UserAvatar username={user.username} avatarUrl={user.avatarUrl} size="lg" />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded transition-colors"
          >
            {uploading ? 'Uploading...' : 'Change Avatar'}
          </button>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="text-center text-gray-300 text-sm mb-4">
          <p className="font-semibold text-white">{user.username}</p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

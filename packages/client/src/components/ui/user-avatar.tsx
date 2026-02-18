import { useConnectionStore } from '../../stores/connection.js';

interface UserAvatarProps {
  username: string;
  avatarUrl: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const colors = [
  'bg-red-600', 'bg-orange-600', 'bg-amber-600', 'bg-yellow-600',
  'bg-lime-600', 'bg-green-600', 'bg-emerald-600', 'bg-teal-600',
  'bg-cyan-600', 'bg-sky-600', 'bg-blue-600', 'bg-indigo-600',
  'bg-violet-600', 'bg-purple-600', 'bg-fuchsia-600', 'bg-pink-600',
];

function getColorForUsername(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-16 h-16 text-2xl',
};

export function UserAvatar({ username, avatarUrl, size = 'md', className = '' }: UserAvatarProps) {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const httpBase = `http://${serverUrl}`;

  if (avatarUrl) {
    const fullUrl = avatarUrl.startsWith('http') ? avatarUrl : `${httpBase}${avatarUrl}`;
    return (
      <img
        src={fullUrl}
        alt={username}
        className={`${sizeClasses[size]} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  const colorClass = getColorForUsername(username);
  return (
    <div className={`${sizeClasses[size]} rounded-full ${colorClass} flex items-center justify-center font-semibold text-white shrink-0 ${className}`}>
      {username.charAt(0).toUpperCase()}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chat.js';
import { useDmStore } from '../../stores/dm.js';
import { useAuthStore } from '../../stores/auth.js';
import { UserAvatar } from '../ui/user-avatar.js';
import { ProfileModal } from '../ui/profile-modal.js';

export function ServerSidebar() {
  const servers = useChatStore((s) => s.servers);
  const activeServerId = useChatStore((s) => s.activeServerId);
  const viewMode = useChatStore((s) => s.viewMode);
  const setActiveServer = useChatStore((s) => s.setActiveServer);
  const createServer = useChatStore((s) => s.createServer);
  const joinServer = useChatStore((s) => s.joinServer);
  const deleteServer = useChatStore((s) => s.deleteServer);
  const logout = useAuthStore((s) => s.logout);
  const currentUser = useAuthStore((s) => s.user);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [input, setInput] = useState('');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; serverId: string; serverName: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ serverId: string; serverName: string } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const handleCreate = async () => {
    if (!input.trim()) return;
    await createServer(input.trim());
    setInput('');
    setShowCreate(false);
  };

  const handleJoin = async () => {
    if (!input.trim()) return;
    await joinServer(input.trim());
    setInput('');
    setShowJoin(false);
  };

  const handleContextMenu = (e: React.MouseEvent, server: { id: string; name: string; ownerId: string }) => {
    e.preventDefault();
    if (server.ownerId !== currentUser?.id) return; // Only show for owner
    setContextMenu({ x: e.clientX, y: e.clientY, serverId: server.id, serverName: server.name });
  };

  const handleDeleteConfirm = async () => {
    if (!showDeleteConfirm) return;
    await deleteServer(showDeleteConfirm.serverId);
    setShowDeleteConfirm(null);
  };

  return (
    <div className="w-[72px] bg-gray-950 flex flex-col items-center py-3 gap-2 shrink-0">
      {/* DM button */}
      <button
        onClick={() => {
          useChatStore.getState().setViewMode('dms');
          useDmStore.getState().loadConversations();
        }}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:rounded-xl ${
          viewMode === 'dms'
            ? 'bg-indigo-600 text-white rounded-xl'
            : 'bg-gray-700 text-gray-300 hover:bg-indigo-500 hover:text-white'
        }`}
        title="Direct Messages"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      <div className="w-8 h-[2px] bg-gray-700 rounded my-1" />

      {servers.map((server) => (
        <button
          key={server.id}
          onClick={() => setActiveServer(server.id)}
          onContextMenu={(e) => handleContextMenu(e, server)}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold transition-all hover:rounded-xl ${
            activeServerId === server.id
              ? 'bg-indigo-600 text-white rounded-xl'
              : 'bg-gray-700 text-gray-300 hover:bg-indigo-500 hover:text-white'
          }`}
          title={server.name}
        >
          {server.name.charAt(0).toUpperCase()}
        </button>
      ))}

      <div className="w-8 h-[2px] bg-gray-700 rounded my-1" />

      {/* Create server */}
      <button
        onClick={() => { setShowCreate(true); setShowJoin(false); setInput(''); }}
        className="w-12 h-12 rounded-2xl bg-gray-700 text-green-400 hover:bg-green-600 hover:text-white flex items-center justify-center text-xl transition-all hover:rounded-xl"
        title="Create Server"
      >
        +
      </button>

      {/* Join server */}
      <button
        onClick={() => { setShowJoin(true); setShowCreate(false); setInput(''); }}
        className="w-12 h-12 rounded-2xl bg-gray-700 text-blue-400 hover:bg-blue-600 hover:text-white flex items-center justify-center text-lg transition-all hover:rounded-xl"
        title="Join Server"
      >
        ↗
      </button>

      <div className="flex-1" />

      {/* User avatar / profile */}
      <button
        onClick={() => setShowProfile(true)}
        className="w-12 h-12 rounded-2xl overflow-hidden hover:rounded-xl transition-all"
        title="Profile Settings"
      >
        <UserAvatar
          username={currentUser?.username || ''}
          avatarUrl={currentUser?.avatarUrl || null}
          size="md"
          className="w-12 h-12 text-lg"
        />
      </button>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-12 h-12 rounded-2xl bg-gray-700 text-red-400 hover:bg-red-600 hover:text-white flex items-center justify-center text-sm transition-all hover:rounded-xl"
        title="Log out"
      >
        ✕
      </button>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 z-50 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              setShowDeleteConfirm({ serverId: contextMenu.serverId, serverName: contextMenu.serverName });
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors"
          >
            Delete Server
          </button>
        </div>
      )}

      {/* Modal for create/join */}
      {(showCreate || showJoin) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowCreate(false); setShowJoin(false); }}>
          <div className="bg-gray-800 rounded-lg p-6 w-80" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">
              {showCreate ? 'Create Server' : 'Join Server'}
            </h2>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={showCreate ? 'Server name' : 'Invite code'}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') showCreate ? handleCreate() : handleJoin();
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCreate(false); setShowJoin(false); }}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={showCreate ? handleCreate : handleJoin}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
              >
                {showCreate ? 'Create' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile modal */}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-gray-800 rounded-lg p-6 w-80" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-2">Delete Server</h2>
            <p className="text-gray-400 text-sm mb-4">
              Are you sure you want to delete <span className="text-white font-semibold">{showDeleteConfirm.serverName}</span>? This will permanently delete all channels and messages. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useChatStore } from '../../stores/chat.js';
import { useAuthStore } from '../../stores/auth.js';

export function ServerSidebar() {
  const servers = useChatStore((s) => s.servers);
  const activeServerId = useChatStore((s) => s.activeServerId);
  const setActiveServer = useChatStore((s) => s.setActiveServer);
  const createServer = useChatStore((s) => s.createServer);
  const joinServer = useChatStore((s) => s.joinServer);
  const logout = useAuthStore((s) => s.logout);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [input, setInput] = useState('');

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

  return (
    <div className="w-[72px] bg-gray-950 flex flex-col items-center py-3 gap-2 shrink-0">
      {servers.map((server) => (
        <button
          key={server.id}
          onClick={() => setActiveServer(server.id)}
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

      {/* Logout */}
      <button
        onClick={logout}
        className="w-12 h-12 rounded-2xl bg-gray-700 text-red-400 hover:bg-red-600 hover:text-white flex items-center justify-center text-sm transition-all hover:rounded-xl"
        title="Log out"
      >
        ✕
      </button>

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
    </div>
  );
}

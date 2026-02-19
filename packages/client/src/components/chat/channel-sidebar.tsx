import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chat.js';
import { useVoiceStore } from '../../stores/voice.js';
import { usePresenceStore } from '../../stores/presence.js';
import { useDmStore } from '../../stores/dm.js';
import { useAuthStore } from '../../stores/auth.js';
import { api } from '../../lib/api.js';
import { ParticipantList } from '../voice/participant-list.js';
import { UserAvatar } from '../ui/user-avatar.js';

interface Member {
  id: string;
  username: string;
  avatarUrl: string | null;
  role: string;
  timeoutUntil: number | null;
}

export function ChannelSidebar() {
  const channels = useChatStore((s) => s.channels);
  const activeChannelId = useChatStore((s) => s.activeChannelId);
  const activeServerId = useChatStore((s) => s.activeServerId);
  const myRole = useChatStore((s) => s.myRole);
  const setActiveChannel = useChatStore((s) => s.setActiveChannel);
  const joinVoice = useVoiceStore((s) => s.joinVoice);
  const activeVoiceChannelId = useVoiceStore((s) => s.activeVoiceChannelId);
  const presenceMap = usePresenceStore((s) => s.presenceMap);
  const currentUser = useAuthStore((s) => s.user);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const createChannel = useChatStore((s) => s.createChannel);
  const deleteChannel = useChatStore((s) => s.deleteChannel);
  const updatePurgeSettings = useChatStore((s) => s.updatePurgeSettings);
  const purgeNow = useChatStore((s) => s.purgeNow);
  const servers = useChatStore((s) => s.servers);

  // Admin context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; member: Member } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'ban' | 'timeout' | 'promote' | 'demote'; member: Member } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Purge state
  const [confirmPurgeNow, setConfirmPurgeNow] = useState(false);
  const activeServer = servers.find((s) => s.id === activeServerId);

  // Channel create/delete state
  const [showCreateChannel, setShowCreateChannel] = useState<'text' | 'voice' | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [channelContextMenu, setChannelContextMenu] = useState<{ x: number; y: number; channelId: string; channelType: string } | null>(null);
  const [confirmDeleteChannel, setConfirmDeleteChannel] = useState<{ id: string; name: string } | null>(null);

  const textChannels = channels.filter((c) => c.type === 'text');
  const voiceChannels = channels.filter((c) => c.type === 'voice');

  useEffect(() => {
    if (!activeServerId) return;
    api.getMembers(activeServerId).then(({ members }) => setMembers(members));
  }, [activeServerId]);

  // Close context menus on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  useEffect(() => {
    if (!channelContextMenu) return;
    const handleClick = () => setChannelContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [channelContextMenu]);

  const onlineMembers = members.filter((m) => presenceMap.has(m.id));
  const offlineMembers = members.filter((m) => !presenceMap.has(m.id));

  const handleCreateInvite = async () => {
    if (!activeServerId) return;
    const { code } = await api.createInvite(activeServerId);
    setInviteCode(code);
  };

  const handleMemberContextMenu = (e: React.MouseEvent, member: Member) => {
    e.preventDefault();
    if (myRole !== 'admin' || member.id === currentUser?.id) return;
    setContextMenu({ x: e.clientX, y: e.clientY, member });
  };

  const handleAdminAction = async () => {
    if (!confirmAction || !activeServerId) return;
    const { type, member } = confirmAction;
    try {
      switch (type) {
        case 'ban':
          await api.banMember(activeServerId, member.id);
          setMembers((prev) => prev.filter((m) => m.id !== member.id));
          break;
        case 'timeout':
          await api.timeoutMember(activeServerId, member.id);
          break;
        case 'promote':
          await api.promoteMember(activeServerId, member.id);
          setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, role: 'admin' } : m));
          break;
        case 'demote':
          await api.demoteMember(activeServerId, member.id);
          setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, role: 'user' } : m));
          break;
      }
    } catch (err) {
      console.error(`Admin action ${type} failed:`, err);
    }
    setConfirmAction(null);
  };

  const renderMember = (m: Member, isOffline: boolean) => (
    <button
      key={m.id}
      onClick={() => useDmStore.getState().openDmWith(m.id)}
      onContextMenu={(e) => handleMemberContextMenu(e, m)}
      className={`w-full flex items-center gap-2 px-2 py-1 text-sm cursor-pointer hover:bg-gray-700/50 rounded transition-colors ${
        isOffline ? 'text-gray-500' : 'text-gray-300'
      }`}
      title={`Message ${m.username}`}
    >
      <UserAvatar username={m.username} avatarUrl={m.avatarUrl} size="sm" className={isOffline ? 'opacity-50' : ''} />
      <span className="truncate">{m.username}</span>
      {m.role === 'admin' && (
        <span className="text-[10px] font-semibold text-yellow-500 ml-auto shrink-0">ADMIN</span>
      )}
    </button>
  );

  const confirmMessages = {
    ban: (name: string) => `Are you sure you want to ban ${name}? They will be removed from this server and cannot rejoin.`,
    timeout: (name: string) => `Timeout ${name} for 5 minutes? They won't be able to send messages in this server.`,
    promote: (name: string) => `Promote ${name} to admin? They will be able to ban, timeout, and manage other users.`,
    demote: (name: string) => `Demote ${name} from admin? They will lose all admin privileges in this server.`,
  };

  const confirmLabels = {
    ban: 'Ban',
    timeout: 'Timeout',
    promote: 'Promote',
    demote: 'Demote',
  };

  return (
    <div className="w-60 bg-gray-800 flex flex-col shrink-0">
      <div className="h-12 px-4 flex items-center border-b border-gray-700 shadow-sm">
        <span className="font-semibold text-white truncate">
          {useChatStore.getState().servers.find((s) => s.id === activeServerId)?.name}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* Text channels */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 mb-1">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Text Channels
            </h3>
            {myRole === 'admin' && (
              <button
                onClick={() => { setShowCreateChannel('text'); setNewChannelName(''); }}
                className="text-gray-400 hover:text-white text-sm leading-none"
                title="Create Text Channel"
              >
                +
              </button>
            )}
          </div>
          {textChannels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (myRole !== 'admin') return;
                setChannelContextMenu({ x: e.clientX, y: e.clientY, channelId: ch.id, channelType: 'text' });
              }}
              className={`w-full px-2 py-1.5 rounded text-left text-sm flex items-center gap-1.5 ${
                activeChannelId === ch.id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
            >
              <span className="text-gray-500">#</span>
              {ch.name}
            </button>
          ))}
        </div>

        {/* Voice channels */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 mb-1">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Voice Channels
            </h3>
            {myRole === 'admin' && (
              <button
                onClick={() => { setShowCreateChannel('voice'); setNewChannelName(''); }}
                className="text-gray-400 hover:text-white text-sm leading-none"
                title="Create Voice Channel"
              >
                +
              </button>
            )}
          </div>
          {voiceChannels.map((ch) => {
            // Show who's in this voice channel from presence data
            const voiceParticipants = members.filter((m) => {
              const p = presenceMap.get(m.id);
              return p?.status === 'in-voice' && p.voiceChannelId === ch.id;
            });

            return (
              <div key={ch.id}>
                <button
                  onClick={() => joinVoice(ch.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (myRole !== 'admin') return;
                    setChannelContextMenu({ x: e.clientX, y: e.clientY, channelId: ch.id, channelType: 'voice' });
                  }}
                  className={`w-full px-2 py-1.5 rounded text-left text-sm flex items-center gap-1.5 ${
                    activeVoiceChannelId === ch.id
                      ? 'bg-gray-700 text-green-400'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                  }`}
                >
                  <span className="text-gray-500">🔊</span>
                  {ch.name}
                </button>
                {activeVoiceChannelId === ch.id ? (
                  <div className="ml-4">
                    <ParticipantList />
                  </div>
                ) : voiceParticipants.length > 0 ? (
                  <div className="ml-6 space-y-0.5">
                    {voiceParticipants.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 px-2 py-0.5 text-xs text-gray-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                        {m.username}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Member list */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">
            Online — {onlineMembers.length}
          </h3>
          {onlineMembers.map((m) => renderMember(m, false))}
          {offlineMembers.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1 mt-3">
                Offline — {offlineMembers.length}
              </h3>
              {offlineMembers.map((m) => renderMember(m, true))}
            </>
          )}
        </div>
      </div>

      {/* Admin: Purge settings */}
      {myRole === 'admin' && activeServer && (
        <div className="p-2 border-t border-gray-700">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">
            Auto-Purge
          </h3>
          <div className="flex items-center gap-2 px-1 mb-2">
            <select
              value={activeServer.purgeAfterDays}
              onChange={(e) => updatePurgeSettings(Number(e.target.value))}
              className="flex-1 bg-gray-900 text-gray-300 text-sm rounded border border-gray-700 px-2 py-1 focus:border-indigo-500 focus:outline-none"
            >
              <option value={0}>Disabled</option>
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
              <option value={365}>365 days</option>
            </select>
          </div>
          <button
            onClick={() => setConfirmPurgeNow(true)}
            className="w-full py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-gray-700 rounded transition-colors"
          >
            Purge Now
          </button>
        </div>
      )}

      {/* Invite button */}
      <div className="p-2 border-t border-gray-700">
        <button
          onClick={handleCreateInvite}
          className="w-full py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        >
          Create Invite
        </button>
        {inviteCode && (
          <div className="mt-2 p-2 bg-gray-900 rounded text-xs">
            <p className="text-gray-400 mb-1">Invite code:</p>
            <code className="text-indigo-400 select-text">{inviteCode}</code>
          </div>
        )}
      </div>

      {/* Admin context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 z-50 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.member.role === 'user' && (
            <button
              onClick={() => { setConfirmAction({ type: 'promote', member: contextMenu.member }); setContextMenu(null); }}
              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              Promote to Admin
            </button>
          )}
          {contextMenu.member.role === 'admin' && (
            <button
              onClick={() => { setConfirmAction({ type: 'demote', member: contextMenu.member }); setContextMenu(null); }}
              className="w-full px-3 py-2 text-left text-sm text-yellow-400 hover:bg-gray-800 hover:text-yellow-300 transition-colors"
            >
              Demote to User
            </button>
          )}
          {contextMenu.member.role !== 'admin' && (
            <>
              <button
                onClick={() => { setConfirmAction({ type: 'timeout', member: contextMenu.member }); setContextMenu(null); }}
                className="w-full px-3 py-2 text-left text-sm text-orange-400 hover:bg-gray-800 hover:text-orange-300 transition-colors"
              >
                Timeout (5 min)
              </button>
              <button
                onClick={() => { setConfirmAction({ type: 'ban', member: contextMenu.member }); setContextMenu(null); }}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors"
              >
                Ban User
              </button>
            </>
          )}
        </div>
      )}

      {/* Confirm modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmAction(null)}>
          <div className="bg-gray-800 rounded-lg p-6 w-80" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-2">{confirmLabels[confirmAction.type]} User</h2>
            <p className="text-gray-400 text-sm mb-4">
              {confirmMessages[confirmAction.type](confirmAction.member.username)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdminAction}
                className={`flex-1 py-2 text-white rounded transition-colors ${
                  confirmAction.type === 'ban' ? 'bg-red-600 hover:bg-red-700' :
                  confirmAction.type === 'timeout' ? 'bg-orange-600 hover:bg-orange-700' :
                  confirmAction.type === 'demote' ? 'bg-yellow-600 hover:bg-yellow-700' :
                  'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {confirmLabels[confirmAction.type]}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create channel modal */}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateChannel(null)}>
          <div className="bg-gray-800 rounded-lg p-6 w-80" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">
              Create {showCreateChannel === 'text' ? 'Text' : 'Voice'} Channel
            </h2>
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="Channel name"
              className="w-full px-3 py-2 bg-gray-900 text-white rounded border border-gray-700 focus:border-indigo-500 focus:outline-none mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newChannelName.trim()) {
                  createChannel(newChannelName.trim(), showCreateChannel);
                  setShowCreateChannel(null);
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateChannel(null)}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newChannelName.trim()) {
                    createChannel(newChannelName.trim(), showCreateChannel);
                    setShowCreateChannel(null);
                  }
                }}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Channel context menu */}
      {channelContextMenu && (
        <div
          className="fixed bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 z-50 min-w-[160px]"
          style={{ left: channelContextMenu.x, top: channelContextMenu.y }}
        >
          <button
            onClick={() => {
              const ch = channels.find((c) => c.id === channelContextMenu.channelId);
              if (ch) setConfirmDeleteChannel({ id: ch.id, name: ch.name });
              setChannelContextMenu(null);
            }}
            disabled={channelContextMenu.channelType === 'text' && textChannels.length <= 1}
            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Channel
          </button>
        </div>
      )}

      {/* Delete channel confirm modal */}
      {confirmDeleteChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmDeleteChannel(null)}>
          <div className="bg-gray-800 rounded-lg p-6 w-80" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-2">Delete Channel</h2>
            <p className="text-gray-400 text-sm mb-4">
              Are you sure you want to delete <span className="text-white font-semibold">#{confirmDeleteChannel.name}</span>? All messages in this channel will be permanently deleted.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteChannel(null)}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteChannel(confirmDeleteChannel.id);
                  setConfirmDeleteChannel(null);
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge now confirm modal */}
      {confirmPurgeNow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmPurgeNow(false)}>
          <div className="bg-gray-800 rounded-lg p-6 w-80" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-2">Purge All Messages</h2>
            <p className="text-gray-400 text-sm mb-4">
              This will permanently delete <span className="text-white font-semibold">all messages</span> from every text channel in this server. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmPurgeNow(false)}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  purgeNow();
                  setConfirmPurgeNow(false);
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Purge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

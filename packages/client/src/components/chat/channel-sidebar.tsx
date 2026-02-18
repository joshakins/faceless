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

  // Admin context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; member: Member } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'ban' | 'timeout' | 'promote' | 'demote'; member: Member } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const textChannels = channels.filter((c) => c.type === 'text');
  const voiceChannels = channels.filter((c) => c.type === 'voice');

  useEffect(() => {
    if (!activeServerId) return;
    api.getMembers(activeServerId).then(({ members }) => setMembers(members));
  }, [activeServerId]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

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
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">
            Text Channels
          </h3>
          {textChannels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
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
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">
            Voice Channels
          </h3>
          {voiceChannels.map((ch) => (
            <div key={ch.id}>
              <button
                onClick={() => joinVoice(ch.id)}
                className={`w-full px-2 py-1.5 rounded text-left text-sm flex items-center gap-1.5 ${
                  activeVoiceChannelId === ch.id
                    ? 'bg-gray-700 text-green-400'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                }`}
              >
                <span className="text-gray-500">🔊</span>
                {ch.name}
              </button>
              {activeVoiceChannelId === ch.id && (
                <div className="ml-4">
                  <ParticipantList />
                </div>
              )}
            </div>
          ))}
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
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chat.js';
import { useVoiceStore } from '../../stores/voice.js';
import { usePresenceStore } from '../../stores/presence.js';
import { api } from '../../lib/api.js';
import { ParticipantList } from '../voice/participant-list.js';

export function ChannelSidebar() {
  const channels = useChatStore((s) => s.channels);
  const activeChannelId = useChatStore((s) => s.activeChannelId);
  const activeServerId = useChatStore((s) => s.activeServerId);
  const setActiveChannel = useChatStore((s) => s.setActiveChannel);
  const joinVoice = useVoiceStore((s) => s.joinVoice);
  const activeVoiceChannelId = useVoiceStore((s) => s.activeVoiceChannelId);
  const presenceMap = usePresenceStore((s) => s.presenceMap);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; username: string }>>([]);

  const textChannels = channels.filter((c) => c.type === 'text');
  const voiceChannels = channels.filter((c) => c.type === 'voice');

  useEffect(() => {
    if (!activeServerId) return;
    api.getMembers(activeServerId).then(({ members }) => setMembers(members));
  }, [activeServerId]);

  const onlineMembers = members.filter((m) => presenceMap.has(m.id));
  const offlineMembers = members.filter((m) => !presenceMap.has(m.id));

  const handleCreateInvite = async () => {
    if (!activeServerId) return;
    const { code } = await api.createInvite(activeServerId);
    setInviteCode(code);
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
          {onlineMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-2 px-2 py-1 text-sm text-gray-300">
              <div className="w-2 h-2 bg-green-500 rounded-full shrink-0" />
              {m.username}
            </div>
          ))}
          {offlineMembers.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1 mt-3">
                Offline — {offlineMembers.length}
              </h3>
              {offlineMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-2 py-1 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-gray-600 rounded-full shrink-0" />
                  {m.username}
                </div>
              ))}
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
    </div>
  );
}

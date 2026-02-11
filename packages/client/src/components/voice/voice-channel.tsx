import { useVoiceStore } from '../../stores/voice.js';

export function VoiceChannel({ channelId, channelName }: { channelId: string; channelName: string }) {
  const joinVoice = useVoiceStore((s) => s.joinVoice);
  const activeVoiceChannelId = useVoiceStore((s) => s.activeVoiceChannelId);
  const participants = useVoiceStore((s) => s.participants);

  const isActive = activeVoiceChannelId === channelId;

  return (
    <div>
      <button
        onClick={() => joinVoice(channelId)}
        className={`w-full px-2 py-1.5 rounded text-left text-sm flex items-center gap-1.5 ${
          isActive ? 'bg-gray-700 text-green-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
        }`}
      >
        <span className="text-gray-500">🔊</span>
        {channelName}
      </button>
      {isActive && participants.length > 0 && (
        <div className="ml-6 text-xs text-gray-500">
          {participants.length} connected
        </div>
      )}
    </div>
  );
}

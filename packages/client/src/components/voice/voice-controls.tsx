import { useState } from 'react';
import { useVoiceStore } from '../../stores/voice.js';
import { useChatStore } from '../../stores/chat.js';
import { ScreenSharePicker } from './screen-share-picker.js';

export function VoiceControls() {
  const leaveVoice = useVoiceStore((s) => s.leaveVoice);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const toggleDeafen = useVoiceStore((s) => s.toggleDeafen);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const voiceChannelId = useVoiceStore((s) => s.activeVoiceChannelId);
  const channels = useChatStore((s) => s.channels);
  const channelName = channels.find((c) => c.id === voiceChannelId)?.name ?? 'Voice';

  const isScreenSharing = useVoiceStore((s) => s.isScreenSharing);
  const screenShareParticipantId = useVoiceStore((s) => s.screenShareParticipantId);
  const startScreenShare = useVoiceStore((s) => s.startScreenShare);
  const stopScreenShare = useVoiceStore((s) => s.stopScreenShare);
  const [showPicker, setShowPicker] = useState(false);

  const someoneElseSharing = screenShareParticipantId !== null && !isScreenSharing;

  const handleScreenShareClick = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else if (!someoneElseSharing) {
      setShowPicker(true);
    }
  };

  const handleSourceSelected = async (sourceId: string) => {
    setShowPicker(false);
    await startScreenShare(sourceId);
  };

  return (
    <>
      <div className="h-14 bg-gray-800 border-t border-gray-700 flex items-center px-4 gap-3 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="text-green-400 text-xs font-semibold">Voice Connected</div>
          <div className="text-gray-400 text-xs truncate">{channelName}</div>
        </div>

        <button
          onClick={toggleMute}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            isMuted ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>

        <button
          onClick={toggleDeafen}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            isDeafened ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {isDeafened ? 'Undeafen' : 'Deafen'}
        </button>

        <button
          onClick={handleScreenShareClick}
          disabled={someoneElseSharing}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            isScreenSharing
              ? 'bg-green-600 text-white hover:bg-green-700'
              : someoneElseSharing
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
        </button>

        <button
          onClick={leaveVoice}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
        >
          Disconnect
        </button>
      </div>

      {showPicker && (
        <ScreenSharePicker onSelect={handleSourceSelected} onClose={() => setShowPicker(false)} />
      )}
    </>
  );
}

import { useVoiceStore } from '../../stores/voice.js';

export function ParticipantList() {
  const participants = useVoiceStore((s) => s.participants);
  const room = useVoiceStore((s) => s.room);
  const speakingIds = useVoiceStore((s) => s.speakingParticipantIds);

  if (!room) return null;

  const localSpeaking = speakingIds.has(room.localParticipant.identity);

  return (
    <div className="space-y-0.5">
      {/* Local participant */}
      <div className="flex items-center gap-2 px-2 py-1 text-sm text-green-400">
        <div className={`w-2 h-2 rounded-full bg-green-400 shrink-0 ${localSpeaking ? 'ring-2 ring-green-400/50 ring-offset-1 ring-offset-gray-800' : ''}`} />
        {room.localParticipant.name || room.localParticipant.identity} (you)
      </div>

      {/* Remote participants */}
      {participants.map((id) => {
        const participant = room.remoteParticipants.get(id);
        if (!participant) return null;
        const isSpeaking = speakingIds.has(participant.identity);
        return (
          <div key={id} className="flex items-center gap-2 px-2 py-1 text-sm text-gray-300">
            <div className={`w-2 h-2 rounded-full bg-green-400 shrink-0 ${isSpeaking ? 'ring-2 ring-green-400/50 ring-offset-1 ring-offset-gray-800' : ''}`} />
            {participant.name || participant.identity}
          </div>
        );
      })}
    </div>
  );
}

import { useVoiceStore } from '../../stores/voice.js';

export function ParticipantList() {
  const participants = useVoiceStore((s) => s.participants);
  const room = useVoiceStore((s) => s.room);

  if (!room) return null;

  return (
    <div className="space-y-1">
      {/* Local participant */}
      <div className="flex items-center gap-2 px-2 py-1 text-sm text-green-400">
        <div className="w-2 h-2 bg-green-400 rounded-full" />
        {room.localParticipant.name || room.localParticipant.identity} (you)
      </div>

      {/* Remote participants */}
      {participants.map((id) => {
        const participant = room.remoteParticipants.get(id);
        if (!participant) return null;
        return (
          <div key={id} className="flex items-center gap-2 px-2 py-1 text-sm text-gray-300">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            {participant.name || participant.identity}
          </div>
        );
      })}
    </div>
  );
}

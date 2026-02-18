import { useDmStore, getConversationDisplayName } from '../../stores/dm.js';
import { useAuthStore } from '../../stores/auth.js';
import { DmMessageList } from './dm-message-list.js';
import { DmMessageInput } from './dm-message-input.js';

export function DmView() {
  const activeConversationId = useDmStore((s) => s.activeConversationId);
  const conversations = useDmStore((s) => s.conversations);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  if (!activeConversation || !currentUserId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select a conversation
      </div>
    );
  }

  const displayName = getConversationDisplayName(activeConversation.participants, currentUserId);

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="h-12 px-4 flex items-center border-b border-gray-700 bg-gray-800 shrink-0">
        <span className="text-gray-400 mr-2">@</span>
        <span className="font-semibold text-white">{displayName}</span>
      </div>
      <DmMessageList />
      <DmMessageInput />
    </div>
  );
}

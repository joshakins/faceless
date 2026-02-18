import { useEffect } from 'react';
import { useDmStore, getConversationDisplayName, getConversationAvatar, isNoteToSelf } from '../../stores/dm.js';
import { useAuthStore } from '../../stores/auth.js';
import { UserAvatar } from '../ui/user-avatar.js';

export function ConversationSidebar() {
  const conversations = useDmStore((s) => s.conversations);
  const activeConversationId = useDmStore((s) => s.activeConversationId);
  const setActiveConversation = useDmStore((s) => s.setActiveConversation);
  const loadConversations = useDmStore((s) => s.loadConversations);
  const openDmWith = useDmStore((s) => s.openDmWith);
  const currentUser = useAuthStore((s) => s.user);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  if (!currentUser) return null;

  const hasNoteToSelf = conversations.some((c) => isNoteToSelf(c.participants, currentUser.id));

  return (
    <div className="w-60 bg-gray-800 flex flex-col border-r border-gray-700 shrink-0">
      {/* Header */}
      <div className="h-12 px-4 flex items-center border-b border-gray-700 shrink-0">
        <span className="font-semibold text-white text-sm">Direct Messages</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Note to Self (always shown at top) */}
        {!hasNoteToSelf && (
          <button
            onClick={() => openDmWith(currentUser.id)}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700/50 transition-colors"
          >
            <UserAvatar username={currentUser.username} avatarUrl={currentUser.avatarUrl} size="md" />
            <div className="min-w-0 flex-1 text-left">
              <div className="text-sm text-gray-300 truncate">Note to Self</div>
            </div>
          </button>
        )}

        {/* Conversation list */}
        {conversations.map((conv) => {
          const displayName = getConversationDisplayName(conv.participants, currentUser.id);
          const avatar = getConversationAvatar(conv.participants, currentUser.id);
          const isActive = conv.id === activeConversationId;
          const preview = conv.lastMessage?.content;

          return (
            <button
              key={conv.id}
              onClick={() => setActiveConversation(conv.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 transition-colors ${
                isActive ? 'bg-gray-700' : 'hover:bg-gray-700/50'
              }`}
            >
              <UserAvatar username={avatar.username} avatarUrl={avatar.avatarUrl} size="md" />
              <div className="min-w-0 flex-1 text-left">
                <div className="text-sm text-white truncate">{displayName}</div>
                {preview && (
                  <div className="text-xs text-gray-400 truncate">{preview}</div>
                )}
              </div>
            </button>
          );
        })}

        {conversations.length === 0 && hasNoteToSelf === false && (
          <div className="text-gray-500 text-sm text-center mt-4 px-4">
            Click a member in any server to start a conversation.
          </div>
        )}
      </div>
    </div>
  );
}

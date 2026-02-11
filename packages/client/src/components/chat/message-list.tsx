import { useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chat.js';

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const typingNames = Array.from(typingUsers.values()).map((t) => t.username);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-1">
      {messages.length === 0 && (
        <div className="text-gray-500 text-center mt-8">No messages yet. Say something!</div>
      )}

      {messages.map((msg, i) => {
        const showAuthor = i === 0 || messages[i - 1].authorId !== msg.authorId;
        const time = new Date(msg.createdAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
          <div key={msg.id} className={`${showAuthor ? 'mt-3' : ''} group hover:bg-gray-800/50 px-2 py-0.5 rounded`}>
            {showAuthor && (
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-white text-sm">{msg.authorUsername}</span>
                <span className="text-xs text-gray-500">{time}</span>
              </div>
            )}
            <p className="text-gray-300 text-sm select-text pl-0">{msg.content}</p>
          </div>
        );
      })}

      {typingNames.length > 0 && (
        <div className="text-xs text-gray-400 italic">
          {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

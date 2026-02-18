import { useEffect, useRef } from 'react';
import { useDmStore } from '../../stores/dm.js';
import { useConnectionStore } from '../../stores/connection.js';
import { UserAvatar } from '../ui/user-avatar.js';

export function DmMessageList() {
  const messages = useDmStore((s) => s.messages);
  const typingUsers = useDmStore((s) => s.typingUsers);
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const bottomRef = useRef<HTMLDivElement>(null);

  const httpBase = `http://${serverUrl}`;

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
        const date = new Date(msg.createdAt * 1000);
        const time = `${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;

        return (
          <div key={msg.id} className={`${showAuthor ? 'mt-3' : ''} group hover:bg-gray-800/50 px-2 py-0.5 rounded`}>
            {showAuthor && (
              <div className="flex items-start gap-3">
                <UserAvatar
                  username={msg.authorUsername}
                  avatarUrl={msg.authorAvatarUrl}
                  size="md"
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-white text-sm">{msg.authorUsername}</span>
                    <span className="text-xs text-gray-500">{time}</span>
                  </div>
                  {msg.content && (
                    <p className="text-gray-300 text-sm select-text">{msg.content}</p>
                  )}
                  {msg.attachment && (
                    <div className="mt-1">
                      <img
                        src={`${httpBase}${msg.attachment.url}`}
                        alt={msg.attachment.filename}
                        className="max-w-sm max-h-80 rounded border border-gray-700 cursor-pointer"
                        onClick={() => window.open(`${httpBase}${msg.attachment!.url}`, '_blank')}
                      />
                    </div>
                  )}
                  {msg.gifUrl && (
                    <div className="mt-1">
                      <img
                        src={msg.gifUrl}
                        alt="GIF"
                        className="max-w-sm max-h-80 rounded border border-gray-700"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            {!showAuthor && (
              <div className="pl-11">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-white text-sm">{msg.authorUsername}</span>
                  <span className="text-xs text-gray-500">{time}</span>
                </div>
                {msg.content && (
                  <p className="text-gray-300 text-sm select-text">{msg.content}</p>
                )}
                {msg.attachment && (
                  <div className="mt-1">
                    <img
                      src={`${httpBase}${msg.attachment.url}`}
                      alt={msg.attachment.filename}
                      className="max-w-sm max-h-80 rounded border border-gray-700 cursor-pointer"
                      onClick={() => window.open(`${httpBase}${msg.attachment!.url}`, '_blank')}
                    />
                  </div>
                )}
                {msg.gifUrl && (
                  <div className="mt-1">
                    <img
                      src={msg.gifUrl}
                      alt="GIF"
                      className="max-w-sm max-h-80 rounded border border-gray-700"
                    />
                  </div>
                )}
              </div>
            )}
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

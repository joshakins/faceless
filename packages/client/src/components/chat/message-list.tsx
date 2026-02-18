import { useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chat.js';
import { useConnectionStore } from '../../stores/connection.js';
import { api } from '../../lib/api.js';
import { UserAvatar } from '../ui/user-avatar.js';

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const myRole = useChatStore((s) => s.myRole);
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const bottomRef = useRef<HTMLDivElement>(null);

  const httpBase = `http://${serverUrl}`;
  const isAdmin = myRole === 'admin';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleMessageLock = useChatStore((s) => s.toggleMessageLock);

  const handleDelete = async (messageId: string) => {
    try {
      await api.deleteMessage(messageId);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleToggleLock = async (messageId: string) => {
    try {
      await toggleMessageLock(messageId);
    } catch (err) {
      console.error('Failed to toggle message lock:', err);
    }
  };

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
          <div key={msg.id} className={`${showAuthor ? 'mt-3' : ''} group hover:bg-gray-800/50 px-2 py-0.5 rounded relative`}>
            {isAdmin && (
              <div className="hidden group-hover:flex absolute top-0 right-1 items-center gap-0.5">
                <button
                  onClick={() => handleToggleLock(msg.id)}
                  className="flex items-center px-1.5 py-0.5 text-xs text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded transition-colors"
                  title={msg.locked ? 'Unlock message' : 'Lock message'}
                >
                  {msg.locked ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => handleDelete(msg.id)}
                  className="flex items-center px-1.5 py-0.5 text-xs text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                  title="Delete message"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
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
                    {msg.locked && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-yellow-500 shrink-0" viewBox="0 0 20 20" fill="currentColor" title="Locked - protected from purge">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    )}
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
                        onError={(e) => console.error('Image load failed:', (e.target as HTMLImageElement).src, msg.attachment)}
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
                  {msg.locked && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-yellow-500 shrink-0" viewBox="0 0 20 20" fill="currentColor" title="Locked - protected from purge">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  )}
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
                      onError={(e) => console.error('Image load failed:', (e.target as HTMLImageElement).src, msg.attachment)}
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

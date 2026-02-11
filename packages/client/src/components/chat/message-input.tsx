import { useState, useRef } from 'react';
import { useChatStore } from '../../stores/chat.js';

export function MessageInput() {
  const [text, setText] = useState('');
  const sendMessage = useChatStore((s) => s.sendMessage);
  const sendTyping = useChatStore((s) => s.sendTyping);
  const typingThrottleRef = useRef<number>(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    const now = Date.now();
    if (now - typingThrottleRef.current > 2000) {
      typingThrottleRef.current = now;
      sendTyping();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 shrink-0">
      <input
        type="text"
        value={text}
        onChange={handleChange}
        placeholder="Type a message..."
        className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
        autoFocus
      />
    </form>
  );
}

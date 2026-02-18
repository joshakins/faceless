import { useEffect, useState } from 'react';
import { useChatStore } from '../../stores/chat.js';
import { ServerSidebar } from '../server/server-list.js';
import { ChannelSidebar } from '../chat/channel-sidebar.js';
import { MessageList } from '../chat/message-list.js';
import { MessageInput } from '../chat/message-input.js';
import { VoiceControls } from '../voice/voice-controls.js';
import { useVoiceStore } from '../../stores/voice.js';
import { ConversationSidebar } from '../dm/conversation-sidebar.js';
import { DmView } from '../dm/dm-view.js';
import { AudioSettingsModal } from '../settings/audio-settings-modal.js';

export function AppShell() {
  const loadServers = useChatStore((s) => s.loadServers);
  const viewMode = useChatStore((s) => s.viewMode);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const activeServerId = useChatStore((s) => s.activeServerId);
  const activeChannelId = useChatStore((s) => s.activeChannelId);
  const channels = useChatStore((s) => s.channels);
  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const voiceChannelId = useVoiceStore((s) => s.activeVoiceChannelId);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  useEffect(() => {
    const unsubscribe = window.faceless.onOpenAudioSettings(() => {
      setShowAudioSettings(true);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Server list */}
      <ServerSidebar />

      {viewMode === 'dms' ? (
        <>
          <ConversationSidebar />
          <DmView />
        </>
      ) : (
        <>
          {/* Channel sidebar */}
          {activeServerId && <ChannelSidebar />}

          {/* Main content */}
          <div className="flex flex-col flex-1 min-w-0">
            {activeChannel && activeChannel.type === 'text' ? (
              <>
                <div className="h-12 px-4 flex items-center border-b border-gray-700 bg-gray-800 shrink-0">
                  <span className="text-gray-400 mr-2">#</span>
                  <span className="font-semibold text-white">{activeChannel.name}</span>
                </div>
                <MessageList />
                <MessageInput />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                {activeServerId ? 'Select a text channel' : 'Select a server'}
              </div>
            )}

            {/* Voice controls bar */}
            {voiceChannelId && <VoiceControls />}
          </div>
        </>
      )}

      {showAudioSettings && (
        <AudioSettingsModal onClose={() => setShowAudioSettings(false)} />
      )}
    </div>
  );
}

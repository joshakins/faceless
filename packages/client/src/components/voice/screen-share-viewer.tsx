import { useEffect, useRef, useState, useCallback } from 'react';
import { useVoiceStore } from '../../stores/voice.js';

export function ScreenShareViewer() {
  const screenShareVideoTrack = useVoiceStore((s) => s.screenShareVideoTrack);
  const isScreenSharing = useVoiceStore((s) => s.isScreenSharing);
  const screenShareParticipantId = useVoiceStore((s) => s.screenShareParticipantId);
  const room = useVoiceStore((s) => s.room);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Determine the sharer's display name
  let sharerName = 'Unknown';
  if (room && screenShareParticipantId) {
    if (screenShareParticipantId === room.localParticipant.identity) {
      sharerName = 'You';
    } else {
      const remote = room.remoteParticipants.get(screenShareParticipantId);
      sharerName = remote?.name || remote?.identity || screenShareParticipantId;
    }
  }

  useEffect(() => {
    if (!screenShareVideoTrack || !videoRef.current) return;
    const el = screenShareVideoTrack.attach(videoRef.current);
    return () => {
      screenShareVideoTrack.detach(el);
    };
  }, [screenShareVideoTrack]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // We are the one sharing — show placeholder
  if (isScreenSharing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-900">
        <div className="text-green-400 text-lg font-semibold mb-2">You are sharing your screen</div>
        <div className="text-gray-400 text-sm">Others in the voice channel can see your screen.</div>
      </div>
    );
  }

  // Remote participant is sharing
  if (screenShareVideoTrack) {
    return (
      <div ref={containerRef} className="flex-1 flex flex-col bg-black relative">
        <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-black/70 to-transparent flex items-center px-4 z-10">
          <span className="text-white text-sm font-medium">{sharerName} is sharing their screen</span>
          <button
            onClick={toggleFullscreen}
            className="ml-auto px-3 py-1 bg-gray-700/80 hover:bg-gray-600 text-white rounded text-xs transition-colors"
          >
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
        <video ref={videoRef} autoPlay playsInline className="flex-1 w-full object-contain" />
      </div>
    );
  }

  return null;
}

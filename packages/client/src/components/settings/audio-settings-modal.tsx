import { useState, useEffect } from 'react';
import { useAudioSettingsStore } from '../../stores/audio-settings.js';

interface AudioSettingsModalProps {
  onClose: () => void;
}

export function AudioSettingsModal({ onClose }: AudioSettingsModalProps) {
  const inputDeviceId = useAudioSettingsStore((s) => s.inputDeviceId);
  const outputDeviceId = useAudioSettingsStore((s) => s.outputDeviceId);
  const setInputDevice = useAudioSettingsStore((s) => s.setInputDevice);
  const setOutputDevice = useAudioSettingsStore((s) => s.setOutputDevice);

  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    async function loadDevices() {
      try {
        // Request microphone permission to get labeled devices
        await navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          stream.getTracks().forEach((t) => t.stop());
        });
      } catch {
        // Permission denied — we'll still show devices but labels may be empty
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      setInputDevices(devices.filter((d) => d.kind === 'audioinput'));
      setOutputDevices(devices.filter((d) => d.kind === 'audiooutput'));
    }

    loadDevices();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-96" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-6">Audio Settings</h2>

        {/* Input device */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Input Device (Microphone)
          </label>
          <select
            value={inputDeviceId}
            onChange={(e) => setInputDevice(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">Default</option>
            {inputDevices.map((device, i) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${i + 1}`}
              </option>
            ))}
          </select>
        </div>

        {/* Output device */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Output Device (Speaker)
          </label>
          <select
            value={outputDeviceId}
            onChange={(e) => setOutputDevice(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">Default</option>
            {outputDevices.map((device, i) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Speaker ${i + 1}`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

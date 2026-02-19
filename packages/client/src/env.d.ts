interface DesktopSource {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  appIconDataUrl: string | null;
}

interface FacelessAPI {
  platform: string;
  onOpenAudioSettings: (callback: () => void) => () => void;
  getDesktopSources: () => Promise<DesktopSource[]>;
}

interface Window {
  faceless: FacelessAPI;
}

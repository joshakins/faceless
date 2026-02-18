interface FacelessAPI {
  platform: string;
  onOpenAudioSettings: (callback: () => void) => () => void;
}

interface Window {
  faceless: FacelessAPI;
}

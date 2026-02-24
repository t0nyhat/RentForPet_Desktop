type AppInfo = {
  version: string;
  name: string;
  isPackaged: boolean;
};

type ElectronRendererApi = {
  getAppInfo: () => Promise<AppInfo>;
  getZoomFactor?: () => number;
  setZoomFactor?: (value: number) => number;
};

declare global {
  interface Window {
    electronAPI?: ElectronRendererApi;
  }
}

export {};

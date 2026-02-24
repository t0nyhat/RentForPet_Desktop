const { contextBridge, ipcRenderer, webFrame } = require('electron');

// Предоставление безопасного доступа к API Electron из React приложения
contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  getZoomFactor: () => webFrame.getZoomFactor(),
  setZoomFactor: (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return webFrame.getZoomFactor();
    }
    webFrame.setZoomFactor(value);
    return webFrame.getZoomFactor();
  }
});

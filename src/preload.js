// Dinghy preload — the entire native surface exposed to the renderer (spec 09).
// The renderer must work identically when window.dinghyNative is absent (plain browser).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dinghyNative', {
  openConfig: () => ipcRenderer.invoke('config:open'),
  saveConfig: (content, opts) => ipcRenderer.invoke('config:save', content, opts || {}),
  grabFrame: (rtspUrl) => ipcRenderer.invoke('frame:grab', rtspUrl),
  checkFfmpeg: () => ipcRenderer.invoke('ffmpeg:check'),
  discoverCameras: () => ipcRenderer.invoke('onvif:discover'),
  getCameraStreams: (opts) => ipcRenderer.invoke('onvif:device', opts),
  onMenu: (cb) => ipcRenderer.on('menu', (_e, action) => cb(action))
});

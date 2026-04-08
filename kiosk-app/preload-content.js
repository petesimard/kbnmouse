const { contextBridge, ipcRenderer } = require('electron');

// Audio recording via main process (ffmpeg)
contextBridge.exposeInMainWorld('kioskAudio', {
  startRecording: () => ipcRenderer.invoke('audio:startRecording'),
  stopRecording: () => ipcRenderer.invoke('audio:stopRecording'),
  onLevel: (callback) => {
    const handler = (event, level) => callback(level);
    ipcRenderer.on('audio:level', handler);
    return () => ipcRenderer.removeListener('audio:level', handler);
  },
});

// Minimal preload for content view — only exposes camera capture
contextBridge.exposeInMainWorld('kioskCamera', {
  capture: () => ipcRenderer.invoke('camera:capture'),
  startStream: () => ipcRenderer.invoke('camera:startStream'),
  stopStream: () => ipcRenderer.invoke('camera:stopStream'),
  getDevice: () => ipcRenderer.invoke('camera:getDevice'),
  onFrame: (callback) => {
    const handler = (event, dataUrl) => callback(dataUrl);
    ipcRenderer.on('camera:frame', handler);
    return () => ipcRenderer.removeListener('camera:frame', handler);
  },
  onDeviceChanged: (callback) => {
    const handler = (event, device) => callback(device);
    ipcRenderer.on('camera:deviceChanged', handler);
    return () => ipcRenderer.removeListener('camera:deviceChanged', handler);
  },
});

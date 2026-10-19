const {contextBridge, ipcRenderer} = require('electron');
function sync(channel, ...args) {
  const result = ipcRenderer.sendSync(channel, ...args);
  if (!result?.ok) throw new Error(result?.error || '데스크톱 저장소에 연결하지 못했습니다.');
  return result.value;
}
contextBridge.exposeInMainWorld('documentStudioDesktop', {
  platform: process.platform,
  readLibrary: () => sync('studio:read'),
  checkStorage: () => sync('studio:check'),
  writeLibrary: raw => sync('studio:write', raw),
  exportBackup: raw => ipcRenderer.invoke('studio:export', raw),
  openBackup: () => ipcRenderer.invoke('studio:open'),
  exportPdf: name => ipcRenderer.invoke('studio:pdf', name),
  print: () => ipcRenderer.invoke('studio:print'),
  openDataFolder: () => ipcRenderer.invoke('studio:data-folder'),
  saveFiles: files => ipcRenderer.invoke('studio:files', files),
  onAction: callback => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('studio:action', handler);
    return () => ipcRenderer.removeListener('studio:action', handler);
  },
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    openDocs: () => ipcRenderer.invoke('open-documentation')
});

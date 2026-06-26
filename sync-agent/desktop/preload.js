const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('operatorAPI', {
    getInfo: () => ipcRenderer.invoke('app:info'),
    act: payload => ipcRenderer.invoke('orders:action', payload),
    copy: text => ipcRenderer.invoke('clipboard:write', text),
    openExternal: url => ipcRenderer.invoke('external:open', url),
    hide: () => ipcRenderer.send('window:hide'),
    onOrders: callback => ipcRenderer.on('orders:update', (_event, data) => callback(data)),
    onConnection: callback => ipcRenderer.on('orders:connection', (_event, data) => callback(data)),
    onAlert: callback => ipcRenderer.on('orders:alert', (_event, data) => callback(data)),
});

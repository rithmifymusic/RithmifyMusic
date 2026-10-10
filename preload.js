const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gmajna', {
  getStore: () => ipcRenderer.invoke('store:get'),
  setStore: (data) => ipcRenderer.invoke('store:set', data),
  importFiles: () => ipcRenderer.invoke('library:import'),
  removeFile: (file) => ipcRenderer.invoke('library:remove', file),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  getVersion: () => ipcRenderer.invoke('app:version'),
  discordUpdate: (payload) => ipcRenderer.invoke('discord:update', payload),
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  setFullscreen: (on) => ipcRenderer.invoke('win:fullscreen', on),
  setMini: (on) => ipcRenderer.invoke('win:mini', on),
  ytSearch: (q) => ipcRenderer.invoke('yt:search', q),
  ytVideoSearch: (q) => ipcRenderer.invoke('yt:videoSearch', q),
  getLyrics: (info) => ipcRenderer.invoke('lyrics:get', info),
  importEncryptedFiles: (account) => ipcRenderer.invoke('library:importEncrypted', account),
  onSpotify: (callback) => ipcRenderer.on('spotify:code', (_e, d) => callback(d)),
  onJamInvite: (callback) => ipcRenderer.on('jam:invite', (_e, d) => callback(d)),
  onMedia: (callback) => ipcRenderer.on('media', (_e, action) => callback(action)),
});

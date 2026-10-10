const { app, BrowserWindow, ipcMain, dialog, globalShortcut, shell, session, safeStorage, nativeImage } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

// Keep the data folder from before the rename to Rythmify so accounts and the offline library stay intact.
app.setPath('userData', path.join(app.getPath('appData'), 'Gmajna Music Priv'));
if (process.platform === 'win32') app.setAppUserModelId('com.gmajna.musicpriv');
const DEFAULT_ACCOUNT_API_URL = 'https://rithmify-server.onrender.com';
const AUDIO_EXT = ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'opus'];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.opus': 'audio/ogg',
};

let win;
let port = 0;
let dataFile;
let offlineDir;
let pendingJamInvite = null;

function parseJamInvite(value) {
  try {
    const link = new URL(value);
    if (link.protocol !== 'gmajna:' || link.hostname !== 'join') return null;
    const room = link.searchParams.get('room') || '';
    if (!/^[\w-]{1,100}$/.test(room)) return null;
    const server = new URL(link.searchParams.get('server') || '');
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(server.hostname);
    if ((server.protocol !== 'https:' && !(server.protocol === 'http:' && local))
        || server.username || server.password || server.search || server.hash || server.pathname !== '/') return null;
    return { room, server: server.origin };
  } catch {
    return null;
  }
}

function handleJamInviteLink(value) {
  const invite = parseJamInvite(value);
  if (!invite) {
    console.warn('Ignored invalid Rythmify Jam invite link.');
    return;
  }
  if (!win || win.isDestroyed() || win.webContents.isLoading()) {
    pendingJamInvite = invite;
    return;
  }
  win.webContents.send('jam:invite', invite);
}

function handleJamInviteArgs(args) {
  const link = args.find((arg) => typeof arg === 'string' && arg.toLowerCase().startsWith('gmajna://'));
  if (link) handleJamInviteLink(link);
}

function deliverPendingJamInvite() {
  if (!pendingJamInvite || !win || win.isDestroyed()) return;
  const invite = pendingJamInvite;
  pendingJamInvite = null;
  win.webContents.send('jam:invite', invite);
}
const ENCRYPTED_MAGIC = Buffer.from('GMENC1');

function readStore() {
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch { return {}; }
}

function writeStore(data) {
  const tmp = dataFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, dataFile);
}

function offlineKey(accountId) {
  if (!/^[\w-]{1,64}$/.test(accountId || '')) throw new Error('Neveljaven profil za šifrirano shrambo.');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Varna shramba operacijskega sistema ni na voljo.');
  const dir = path.join(app.getPath('userData'), 'offline-keys');
  fs.mkdirSync(dir, { recursive: true });
  const keyFile = path.join(dir, `${crypto.createHash('sha256').update(accountId).digest('hex')}.key`);
  if (fs.existsSync(keyFile)) {
    const stored = fs.readFileSync(keyFile);
    const key = Buffer.from(safeStorage.decryptString(stored), 'base64');
    if (key.length !== 32) throw new Error('Ključ za šifrirano knjižnico je poškodovan.');
    return key;
  }
  const key = crypto.randomBytes(32);
  const encrypted = safeStorage.encryptString(key.toString('base64'));
  const tmp = `${keyFile}.tmp`;
  fs.writeFileSync(tmp, encrypted, { mode: 0o600 });
  fs.renameSync(tmp, keyFile);
  return key;
}

async function decryptOfflineFile(file) {
  const bytes = await fs.promises.readFile(file);
  const minSize = ENCRYPTED_MAGIC.length + 1 + 1 + 12 + 16;
  if (bytes.length < minSize || !bytes.subarray(0, ENCRYPTED_MAGIC.length).equals(ENCRYPTED_MAGIC)) {
    throw new Error('Neveljavna šifrirana datoteka.');
  }
  const idLength = bytes[ENCRYPTED_MAGIC.length];
  const idStart = ENCRYPTED_MAGIC.length + 1;
  const ivStart = idStart + idLength;
  if (!idLength || ivStart + 12 + 16 > bytes.length) throw new Error('Neveljavna šifrirana datoteka.');
  const accountId = bytes.toString('utf8', idStart, ivStart);
  const key = offlineKey(accountId);
  const iv = bytes.subarray(ivStart, ivStart + 12);
  const tag = bytes.subarray(bytes.length - 16);
  const ciphertext = bytes.subarray(ivStart + 12, bytes.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function verifyPremiumAccount(token, accountId) {
  const apiUrl = DEFAULT_ACCOUNT_API_URL;
  let base;
  try { base = new URL(String(apiUrl || '').trim()); }
  catch { throw new Error('Naslov strežnika računov ni veljaven.'); }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(local && base.protocol === 'http:')) || base.username || base.password || base.search || base.hash) {
    throw new Error('Naslov strežnika računov ni varen.');
  }
  if (typeof token !== 'string' || !token || typeof accountId !== 'string' || !accountId) {
    throw new Error('Za šifriran uvoz se prijavi v Premium profil.');
  }
  const url = `${base.origin}${base.pathname.replace(/\/+$/, '')}/api/billing/status`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Preverjanje Premiuma ni uspelo (HTTP ${response.status}).`);
  if (result.accountId !== accountId) throw new Error('Premium profil se ne ujema s prijavljenim računom.');
  if (!result.isPremium) throw new Error('Šifrirana shramba je na voljo samo s Premium naročnino.');
}

async function encryptOfflineFile(source, destination, key, accountId) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const tmp = `${destination}.tmp`;
  try {
    const id = Buffer.from(accountId, 'utf8');
    const header = Buffer.concat([ENCRYPTED_MAGIC, Buffer.from([id.length]), id, iv]);
    await fs.promises.writeFile(tmp, header);
    await pipeline(fs.createReadStream(source), cipher, fs.createWriteStream(tmp, { flags: 'a' }));
    await fs.promises.appendFile(tmp, cipher.getAuthTag());
    await fs.promises.rename(tmp, destination);
  } catch (e) {
    try { await fs.promises.unlink(tmp); }
    catch (cleanupError) { if (cleanupError.code !== 'ENOENT') console.error('offline temp cleanup:', cleanupError.message); }
    throw e;
  }
}

function serveBuffer(req, res, file, data) {
  const ext = path.extname(file).toLowerCase() === '.enc'
    ? path.extname(file.slice(0, -4)).toLowerCase()
    : path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range) {
    const start = range[1] ? parseInt(range[1], 10) : 0;
    const end = range[2] ? Math.min(parseInt(range[2], 10), data.length - 1) : data.length - 1;
    if (start > end || start >= data.length) { res.writeHead(416); res.end(); return; }
    res.writeHead(206, {
      'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1,
    });
    res.end(data.subarray(start, end + 1));
    return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': data.length });
  res.end(data);
}

function serveFile(req, res, file) {
  if (path.extname(file).toLowerCase() === '.enc') {
    decryptOfflineFile(file).then((data) => serveBuffer(req, res, file, data)).catch((e) => {
      console.error('offline decrypt:', e.message);
      if (!res.headersSent) { res.writeHead(500); res.end(); }
    });
    return;
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end(); return; }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? parseInt(range[1], 10) : 0;
      const end = range[2] ? Math.min(parseInt(range[2], 10), stat.size - 1) : stat.size - 1;
      if (start > end || start >= stat.size) { res.writeHead(416); res.end(); return; }
      res.writeHead(206, {
        'Content-Type': type, 'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1,
      });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': stat.size });
    fs.createReadStream(file).pipe(res);
  });
}

function startServer() {
  const root = path.join(__dirname, 'renderer');
  const socketClient = path.join(__dirname, 'node_modules', 'socket.io-client', 'dist', 'socket.io.min.js');
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (pathname === '/callback') {
      const q = new URL(req.url, 'http://x').searchParams;
      if (win && !win.isDestroyed()) win.webContents.send('spotify:code', { code: q.get('code') || '', error: q.get('error') || '', state: q.get('state') || '' });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<body style="font-family:sans-serif;background:#121212;color:#fff;text-align:center;padding-top:20vh"><h2>Spotify povezan ✓</h2><p>To okno lahko zapreš in se vrneš v Rythmify.</p>');
      return;
    }
    if (pathname === '/vendor/socket.io.js') return serveFile(req, res, socketClient);
    if (pathname.startsWith('/media/')) {
      const name = path.basename(pathname);
      return serveFile(req, res, path.join(offlineDir, name));
    }
    const target = path.normalize(path.join(root, pathname === '/' ? 'index.html' : pathname));
    if (!target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    serveFile(req, res, target);
  });
  const SPOTIFY_PORT = 38457;
  return new Promise((resolve) => {
    const done = () => { port = server.address().port; resolve(); };
    server.once('error', () => server.listen(0, '127.0.0.1', done));
    server.listen(SPOTIFY_PORT, '127.0.0.1', done);
  });
}

// Network-level blocking of ad/tracker requests (public filter lists).
async function setupAdblock() {
  try {
    const { ElectronBlocker } = require('@ghostery/adblocker-electron');
    const fetch = require('cross-fetch');
    const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
      path: path.join(app.getPath('userData'), 'adblock.bin'),
      read: fs.promises.readFile,
      write: fs.promises.writeFile,
    });
    blocker.enableBlockingInSession(session.defaultSession);
  } catch (e) { console.error('adblock:', e.message); }
}

// When an ad still plays inside the embedded player, mute it and jump to its end.
const AD_SKIP_JS = `(() => {
  const p = document.querySelector('#movie_player');
  const v = document.querySelector('video');
  if (!p || !v) return;
  if (p.classList.contains('ad-showing')) {
    if (!v.dataset.gmMuted) { v.dataset.gmMuted = '1'; v.dataset.gmWas = v.muted ? '1' : ''; }
    v.muted = true;
    if (isFinite(v.duration) && v.duration > 0 && v.duration < 90) v.currentTime = v.duration;
    document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button')?.click();
  } else if (v.dataset.gmMuted) {
    v.muted = !!v.dataset.gmWas;
    delete v.dataset.gmMuted;
    delete v.dataset.gmWas;
  }
})()`;
function startAdSkipper() {
  setInterval(() => {
    if (!win || win.isDestroyed()) return;
    for (const f of win.webContents.mainFrame.framesInSubtree) {
      if (/^https:\/\/www\.youtube\.com\/embed\//.test(f.url)) f.executeJavaScript(AD_SKIP_JS).catch(() => {});
    }
  }, 300);
}

function createWindow() {
  const iconPath = process.platform === 'win32' && app.isPackaged
    ? path.join(process.resourcesPath, 'rythmify.ico')
    : path.join(__dirname, 'renderer', 'img', process.platform === 'win32' ? 'rythmify.ico' : 'logo.png');
  const appIcon = nativeImage.createFromPath(iconPath);
  if (appIcon.isEmpty()) throw new Error(`Neveljavna ikona aplikacije: ${iconPath}`);
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    backgroundColor: '#121212', title: 'Rythmify', autoHideMenuBar: true,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required',
    },
  });
  win.setIcon(appIcon);
  win.removeMenu();
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.once('did-finish-load', deliverPendingJamInvite);
  win.loadURL(`http://127.0.0.1:${port}/`);
}

function registerMediaKeys() {
  const keys = {
    MediaPlayPause: 'toggle', MediaNextTrack: 'next', MediaPreviousTrack: 'prev',
  };
  for (const [key, action] of Object.entries(keys)) {
    globalShortcut.register(key, () => win && win.webContents.send('media', action));
  }
}

ipcMain.handle('store:get', () => readStore());
ipcMain.handle('store:set', (_e, data) => { writeStore(data); return true; });
ipcMain.handle('app:info', () => ({ port, offlineDir }));

// Unofficial YouTube Music search; it needs no Data API key but may be rate-limited or change.
ipcMain.handle('yt:search', async (_e, query) => {
  const r = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://music.youtube.com', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20240918.01.00', hl: 'sl', gl: 'SI' } },
      query: String(query || '').slice(0, 200), params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA==',
    }),
  });
  if (!r.ok) throw new Error(`InnerTube ${r.status}`);
  const j = await r.json();
  const sections = j.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
  const out = [];
  for (const s of sections) {
    for (const c of s.musicShelfRenderer?.contents || []) {
      const i = c.musicResponsiveListItemRenderer;
      const videoId = i?.playlistItemData?.videoId;
      if (!videoId) continue;
      const col = (n) => (i.flexColumns?.[n]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []).map((x) => x.text);
      const meta = col(1).join('').split(' • ');
      const dur = /^(?:(\d+):)?(\d+):(\d+)$/.exec(meta[meta.length - 1] || '');
      const seconds = dur ? (+dur[1] || 0) * 3600 + +dur[2] * 60 + +dur[3] : 0;
      const thumb = i.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';
      out.push({ videoId, title: col(0).join(''), artist: meta[0] || '', seconds, cover: thumb.replace(/=w\d+-h\d+.*$/, '=w226-h226') });
    }
  }
  return out;
});

ipcMain.handle('yt:videoSearch', async (_e, query) => {
  const r = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://www.youtube.com', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion: '2.20241010.01.00', hl: 'sl', gl: 'SI' } },
      query: String(query || '').slice(0, 200),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`YouTube ${r.status}`);
  const j = await r.json();
  const sections = j.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
  const out = [];
  for (const section of sections) {
    for (const item of section.itemSectionRenderer?.contents || []) {
      const video = item.videoRenderer;
      const videoId = video?.videoId;
      const duration = video?.lengthText?.simpleText || '';
      const match = /^(?:(\d+):)?(\d+):(\d+)$/.exec(duration);
      const seconds = match ? (+match[1] || 0) * 3600 + +match[2] * 60 + +match[3] : 0;
      if (!/^[\w-]{11}$/.test(videoId || '') || seconds < 60 || seconds > 720) continue;
      const runs = (value) => (value?.runs || []).map((run) => run.text || '').join('');
      const cover = video.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';
      out.push({
        videoId, title: runs(video.title), artist: runs(video.ownerText),
        seconds, cover: cover.startsWith('https://') ? cover : '',
      });
    }
  }
  return out;
});

// "Download": copy user-owned/licensed audio files into the offline cache.
ipcMain.handle('library:import', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Dodaj glasbo (lastne ali licencirane datoteke)',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: AUDIO_EXT }],
  });
  if (result.canceled) return [];
  const tracks = [];
  for (const source of result.filePaths) {
    const ext = path.extname(source).toLowerCase();
    const base = path.basename(source, ext);
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const file = `${id}${ext}`;
    try {
      await fs.promises.copyFile(source, path.join(offlineDir, file));
    } catch { continue; }
    const parts = base.split(' - ');
    tracks.push({
      id, type: 'local', file,
      title: parts.length > 1 ? parts.slice(1).join(' - ').trim() : base,
      artist: parts.length > 1 ? parts[0].trim() : 'Neznan izvajalec',
      addedAt: Date.now(),
    });
  }
  return tracks;
});

ipcMain.handle('library:importEncrypted', async (_e, accountInfo) => {
  const info = accountInfo && typeof accountInfo === 'object' ? accountInfo : {};
  await verifyPremiumAccount(info.token, info.accountId);
  const key = offlineKey(info.accountId);
  const result = await dialog.showOpenDialog(win, {
    title: 'Uvozi lastne ali licencirane zvočne datoteke v šifrirano shrambo',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: AUDIO_EXT }],
  });
  if (result.canceled) return [];
  const tracks = [];
  const created = [];
  try {
    for (const source of result.filePaths) {
      const ext = path.extname(source).toLowerCase();
      const base = path.basename(source, ext);
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const file = `${id}${ext}.enc`;
      const destination = path.join(offlineDir, file);
      await encryptOfflineFile(source, destination, key, info.accountId);
      created.push(destination);
      const parts = base.split(' - ');
      tracks.push({
        id, type: 'local', file, encrypted: true,
        title: parts.length > 1 ? parts.slice(1).join(' - ').trim() : base,
        artist: parts.length > 1 ? parts[0].trim() : 'Neznan izvajalec',
        addedAt: Date.now(),
      });
    }
    return tracks;
  } catch (e) {
    const cleanup = await Promise.allSettled(created.map((file) => fs.promises.unlink(file)));
    for (const result of cleanup) {
      if (result.status === 'rejected' && result.reason.code !== 'ENOENT') {
        console.error('offline import cleanup:', result.reason.message);
      }
    }
    throw new Error(`Šifriran uvoz ni uspel: ${e.message}`);
  }
});

ipcMain.handle('library:remove', async (_e, file) => {
  if (typeof file !== 'string' || path.basename(file) !== file) return false;
  try { await fs.promises.unlink(path.join(offlineDir, file)); } catch { /* already gone */ }
  return true;
});

ipcMain.handle('app:openExternal', (_e, url) => {
  if (typeof url === 'string' && /^https:\/\//.test(url)) shell.openExternal(url);
});

let normalBounds = null;
ipcMain.handle('win:fullscreen', (_e, on) => {
  if (!win) return false;
  win.setFullScreen(typeof on === 'boolean' ? on : !win.isFullScreen());
  return win.isFullScreen();
});
ipcMain.handle('win:mini', (_e, on) => {
  if (!win) return;
  if (on) {
    if (win.isFullScreen()) win.setFullScreen(false);
    if (win.isMaximized()) win.unmaximize();
    normalBounds = win.getBounds();
    win.setMinimumSize(520, 110);
    win.setSize(900, 110, true);
    win.setAlwaysOnTop(true);
  } else {
    win.setAlwaysOnTop(false);
    win.setMinimumSize(900, 600);
    if (normalBounds) win.setBounds(normalBounds, true);
  }
});

if (!app.requestSingleInstanceLock()) app.quit();
else {
  const registered = process.defaultApp && process.argv[1]
    ? app.setAsDefaultProtocolClient('gmajna', process.execPath, [path.resolve(process.argv[1])])
    : app.setAsDefaultProtocolClient('gmajna');
  if (!registered) console.warn('Could not register the gmajna:// protocol handler.');
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleJamInviteLink(url);
});
handleJamInviteArgs(process.argv);

function setupUpdater() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.on('update-downloaded', (info) => {
      dialog.showMessageBox(win, {
        type: 'info', buttons: ['Znova zaženi zdaj', 'Pozneje'], defaultId: 0,
        message: `Nova različica ${info.version} je pripravljena.`,
        detail: 'Posodobitev se namesti ob ponovnem zagonu aplikacije.',
      }).then((r) => { if (r.response === 0) autoUpdater.quitAndInstall(); });
    });
    autoUpdater.on('error', (e) => console.error('updater', e.message));
    const checkForUpdates = () => autoUpdater.checkForUpdates().catch((e) => console.error('updater check failed:', e.message));
    checkForUpdates();
    setInterval(checkForUpdates, 4 * 60 * 60 * 1000);
  } catch (e) { console.error('updater', e.message); }
}

app.whenReady().then(async () => {
  dataFile = path.join(app.getPath('userData'), 'data.json');
  offlineDir = path.join(app.getPath('userData'), 'offline');
  fs.mkdirSync(offlineDir, { recursive: true });
  await startServer();
  // The embedded player rejects requests that carry no valid HTTPS referrer (file/localhost origins).
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://www.youtube.com/*', 'https://www.youtube-nocookie.com/*'] },
    (details, cb) => {
      details.requestHeaders.Referer = 'https://gmajna.app/';
      cb({ requestHeaders: details.requestHeaders });
    });
  createWindow();
  setupAdblock();
  startAdSkipper();
  setupUpdater();
  registerMediaKeys();
});

app.on('second-instance', (_event, commandLine) => {
  handleJamInviteArgs(commandLine);
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());

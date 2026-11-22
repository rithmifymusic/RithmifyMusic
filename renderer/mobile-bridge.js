(function installMobileBridge() {
  if (window.gmajna || window.require) return;

  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const storeKey = 'rythmify-mobile-store';
  const readStore = () => {
    try { return JSON.parse(localStorage.getItem(storeKey) || '{}'); }
    catch (error) { console.warn('Mobile store could not be read:', error); return {}; }
  };
  const unsupported = (name) => Promise.reject(new Error(`${name} ni na voljo v Android različici.`));
  const timeout = (ms) => (AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);

  // The WebView fetch drops forbidden headers such as Origin, which YouTube's InnerTube API may require.
  // POSTs to YouTube therefore go straight to the native HTTP plugin with the headers untouched.
  const nativeHttp = native ? (window.Capacitor.Plugins?.CapacitorHttp || window.Capacitor.registerPlugin('CapacitorHttp')) : null;
  if (nativeHttp) {
    const webFetch = window.fetch.bind(window);
    window.fetch = async (resource, options = {}) => {
      const url = String(resource?.url || resource);
      const method = String(options.method || 'GET').toUpperCase();
      if (method !== 'POST' || !/^https:\/\/(?:music|www)\.youtube\.com\//.test(url)) return webFetch(resource, options);
      const headers = options.headers instanceof Headers ? Object.fromEntries(options.headers.entries()) : { ...(options.headers || {}) };
      let data = options.body;
      try { data = JSON.parse(options.body); } catch { /* send the raw body */ }
      const result = await nativeHttp.request({ url, method, headers, data, responseType: 'text', connectTimeout: 15000, readTimeout: 15000 });
      const text = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
      return new Response(text, { status: result.status, headers: { 'Content-Type': 'application/json' } });
    };
  }

  // The YouTube Music client is shared with the desktop app (ytmusic.js is a CommonJS module).
  let ytPromise = null;
  function loadYt() {
    if (!ytPromise) {
      ytPromise = new Promise((resolve, reject) => {
        const previous = window.module;
        window.module = { exports: {} };
        const script = document.createElement('script');
        script.src = 'ytmusic.js';
        script.onload = () => { const api = window.module.exports; window.module = previous; resolve(api); };
        script.onerror = () => { window.module = previous; ytPromise = null; reject(new Error('Iskalnik se ni naložil.')); };
        document.head.append(script);
      });
    }
    return ytPromise;
  }
  const yt = (method) => async (...args) => (await loadYt())[method](...args);

  async function searchYouTubeVideos(query, { minSeconds = 60, maxSeconds = 720 } = {}) {
    const r = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://www.youtube.com', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20241010.01.00', hl: 'sl', gl: 'SI' } },
        query: String(query || '').slice(0, 200),
      }),
      signal: timeout(15000),
    });
    if (!r.ok) throw new Error(`YouTube ${r.status}`);
    const j = await r.json();
    const sections = j.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    const runs = (value) => (value?.runs || []).map((run) => run.text || '').join('');
    const out = [];
    for (const section of sections) {
      for (const item of section.itemSectionRenderer?.contents || []) {
        const video = item.videoRenderer;
        const videoId = video?.videoId;
        const match = /^(?:(\d+):)?(\d+):(\d+)$/.exec(video?.lengthText?.simpleText || '');
        const seconds = match ? (+match[1] || 0) * 3600 + +match[2] * 60 + +match[3] : 0;
        if (!/^[\w-]{11}$/.test(videoId || '') || seconds < minSeconds || (maxSeconds > 0 && seconds > maxSeconds)) continue;
        const cover = video.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';
        out.push({
          videoId, title: runs(video.title), artist: runs(video.ownerText),
          seconds, cover: cover.startsWith('https://') ? cover : '',
        });
      }
    }
    return out;
  }

  async function getLyrics({ title, artist, duration } = {}) {
    const clean = (s) => String(s || '').replace(/\s*[(\[][^)\]]*[)\]]/g, '').replace(/\b(official|video|audio|lyrics?|hd|4k|mv)\b/gi, '')
      .replace(/\s*(ft\.?|feat\.?)\s.*$/i, '').replace(/\s+/g, ' ').trim();
    const cleanArtist = (s) => String(s || '').replace(/\s*-\s*topic$/i, '').replace(/vevo$/i, '').replace(/\s+/g, ' ').trim();
    const attempts = [];
    const parts = String(title || '').split(/\s[-–]\s/);
    if (parts.length >= 2) attempts.push({ artist: clean(parts[0]), title: clean(parts.slice(1).join(' ')) });
    attempts.push({ artist: cleanArtist(artist), title: clean(title) });
    const get = async (url) => {
      try {
        const r = await fetch(url, { signal: timeout(8000) });
        return r.ok ? await r.json() : null;
      } catch { return null; }
    };
    const best = (list) => {
      const withSync = (Array.isArray(list) ? list : []).filter((x) => x && x.syncedLyrics);
      if (!withSync.length) return null;
      if (!duration) return withSync[0];
      return withSync.sort((x, y) => Math.abs((x.duration || 0) - duration) - Math.abs((y.duration || 0) - duration))[0];
    };
    let plain = '';
    for (const a of attempts) {
      if (!a.title) continue;
      const q = new URLSearchParams({ track_name: a.title });
      if (a.artist) q.set('artist_name', a.artist);
      let hit = best(await get(`https://lrclib.net/api/search?${q}`));
      if (!hit) hit = best(await get(`https://lrclib.net/api/search?${new URLSearchParams({ q: `${a.artist} ${a.title}`.trim() })}`));
      if (hit) return { synced: hit.syncedLyrics, plain: hit.plainLyrics || '' };
      if (!plain) {
        const any = await get(`https://lrclib.net/api/search?${q}`);
        plain = (Array.isArray(any) && any.find((x) => x.plainLyrics)?.plainLyrics) || '';
      }
    }
    return plain ? { synced: '', plain } : null;
  }

  const safeFeed = (value) => {
    try {
      const feed = new URL(value);
      return feed.protocol === 'https:' && !feed.username && !feed.password && !feed.port
        && !/^[\d.]+$/.test(feed.hostname) && !feed.hostname.includes(':')
        && feed.hostname !== 'localhost'
        && !feed.hostname.endsWith('.localhost') && !feed.hostname.endsWith('.local');
    } catch { return false; }
  };

  async function podcastSearch(query) {
    const term = String(query || '').trim().slice(0, 160);
    if (!term) return [];
    const url = `https://itunes.apple.com/search?${new URLSearchParams({ term, media: 'podcast', entity: 'podcast', limit: '30', country: 'SI' })}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: timeout(15000) });
    if (!response.ok) throw new Error(`Apple Podcasts ${response.status}`);
    const data = await response.json();
    return (data.results || []).filter((item) => !!item.collectionId && safeFeed(item.feedUrl)).map((item) => ({
      id: String(item.collectionId),
      title: String(item.collectionName || '').slice(0, 300),
      artist: String(item.artistName || '').slice(0, 200),
      artwork: String(item.artworkUrl600 || item.artworkUrl100 || ''),
      feedUrl: item.feedUrl,
      url: String(item.collectionViewUrl || ''),
      episodeCount: Number(item.trackCount) || 0,
      genre: String(item.primaryGenreName || ''),
    }));
  }

  async function podcastEpisodes(feedUrl) {
    if (!safeFeed(String(feedUrl || ''))) throw new Error('RSS vir mora uporabljati varen HTTPS naslov.');
    const response = await fetch(String(feedUrl), {
      headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
      signal: timeout(20000),
    });
    if (!response.ok) throw new Error(`RSS vir ${response.status}`);
    const xml = await response.text();
    if (xml.length > 6 * 1024 * 1024) throw new Error('RSS vir je prevelik za obdelavo.');
    return xml;
  }

  // Native lock-screen / notification controls (MediaControls plugin in the Android project).
  const mediaPlugin = native && window.Capacitor.registerPlugin ? window.Capacitor.registerPlugin('MediaControls') : null;
  let lastMedia = { key: '', position: 0, playing: false, at: 0 };

  // Keep the page "visible" so the embedded YouTube player and timers keep running while the screen is off.
  if (native) {
    try {
      Object.defineProperty(document, 'hidden', { get: () => false });
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
      document.addEventListener('visibilitychange', (event) => event.stopImmediatePropagation(), true);
    } catch (error) { console.warn('Visibility override failed:', error); }
  }

  window.gmajna = {
    getStore: async () => readStore(),
    setStore: async (data) => {
      try { localStorage.setItem(storeKey, JSON.stringify(data || {})); } catch (error) { console.warn('Store write failed:', error); }
      return true;
    },
    openExternal: async (url) => { window.open(String(url), '_blank', 'noopener'); },
    getVersion: async () => '1.3.0',
    setFullscreen: async () => false,
    openPopout: async () => {},
    closePopout: async () => {},
    sendPopoutState: () => {},
    popoutCommand: () => {},
    onPopoutState: () => {},
    onPopoutCommand: () => {},
    onMedia: (callback) => { mediaPlugin?.addListener('media', (event) => callback(event.action, event.value)); },
    mediaState: (state) => {
      if (!mediaPlugin) return;
      const now = Date.now();
      const key = `${state.title}|${state.artist}|${state.cover}|${state.playing}|${state.liked}|${state.shuffle}|${Math.round(state.duration || 0)}`;
      const expected = lastMedia.position + (lastMedia.playing ? (now - lastMedia.at) / 1000 : 0);
      const jumped = Math.abs((state.position || 0) - expected) > 2.5;
      if (key === lastMedia.key && !jumped) return;
      lastMedia = { key, position: state.position || 0, playing: !!state.playing, at: now };
      mediaPlugin.update(state).catch((error) => console.warn('Media controls:', error));
    },
    discordUpdate: async () => {},
    checkUpdate: async () => ({ status: 'latest', current: '1.3.0' }),
    importFiles: async () => [],
    removeFile: async () => {},
    importEncryptedFiles: () => unsupported('Šifrirana offline knjižnica'),
    ytSearch: yt('search'),
    ytSearchKind: yt('searchKind'),
    ytBrowse: yt('browse'),
    ytRadio: yt('radio'),
    ytVideoSearch: (q) => searchYouTubeVideos(q),
    podcastYouTubeSearch: (q) => {
      const term = String(q || '').trim().slice(0, 160);
      return term ? searchYouTubeVideos(`${term} podcast`, { minSeconds: 60, maxSeconds: 0 }) : Promise.resolve([]);
    },
    podcastSearch,
    podcastEpisodes,
    getLyrics,
    onSpotify: () => {},
    onJamInvite: () => {},
  };
})();

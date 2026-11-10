'use strict';

// Artists, albums and playlists from YouTube Music, plus the search results page that surfaces them.
// This file loads before gmajna.js and only runs on demand, so it may use the globals declared there.
const Artists = (() => {
  const PAGE_TTL = 10 * 60 * 1000;
  const FIND_TTL = 30 * 60 * 1000;
  const MIN_SCORE = 0.7;
  const RECENT_KEY = 'rythmify.recent';
  const pages = new Map();
  const radios = new Map();
  const finds = new Map();
  const failures = new Map();
  let searchSeq = 0;

  const cssUrl = (url) => String(url).replace(/["'\\()\s]/g, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
  const plain = (s) => (/&[#\w]+;/.test(s) ? decode(s) : s);
  const onEnter = (fn) => (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fn(); } };

  function friendlyError(error) {
    const message = String(error?.message || error || '').replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
    if (/InnerTube 429/.test(message)) return 'YouTube Music začasno omejuje zahteve. Poskusi čez nekaj minut.';
    if (/InnerTube \d+|fetch failed|timeout|aborted|network|ENOTFOUND|ECONN/i.test(message)) return 'Povezava z YouTube Music ni uspela. Preveri internet in poskusi znova.';
    return message || 'Prišlo je do napake.';
  }

  function toTrack(item) {
    const track = {
      id: `yt:${item.videoId}`, type: 'yt', videoId: item.videoId,
      title: plain(item.title || ''), artist: plain(item.artist || ''), cover: item.cover || '',
    };
    if (item.seconds) track.seconds = item.seconds;
    if (item.artistId) track.artistId = item.artistId;
    if (item.album) {
      track.album = plain(item.album);
      if (item.albumId) track.albumId = item.albumId;
    }
    return track;
  }

  // Caches hold the promise (so parallel callers share one request) and the resolved value (for instant re-renders).
  function load(map, key, ttl, fetcher) {
    const hit = map.get(key);
    if (hit && Date.now() - hit.t < ttl) return hit.p;
    const entry = { t: Date.now(), v: undefined, p: null };
    entry.p = fetcher().then((value) => { entry.v = value; return value; });
    entry.p.catch(() => { if (map.get(key) === entry) map.delete(key); });
    map.set(key, entry);
    if (map.size > 80) map.delete(map.keys().next().value);
    return entry.p;
  }
  const peek = (map, key, ttl) => {
    const hit = map.get(key);
    return hit && hit.v !== undefined && Date.now() - hit.t < ttl ? hit.v : undefined;
  };
  const getPage = (id) => load(pages, id, PAGE_TTL, () => window.gmajna.ytBrowse(id));
  const getRadio = (seed) => load(radios, `${seed.videoId}|${seed.playlistId}|${seed.params || ''}`, PAGE_TTL, () => window.gmajna.ytRadio(seed));
  const findArtists = (q) => load(finds, `a|${q.toLowerCase()}`, FIND_TTL, () => window.gmajna.ytSearchKind(q, 'artists'));
  const findAlbums = (q) => load(finds, `b|${q.toLowerCase()}`, FIND_TTL, () => window.gmajna.ytSearchKind(q, 'albums'));
  const findVideos = (q) => load(finds, `v|${q.toLowerCase()}`, FIND_TTL, () => window.gmajna.ytSearchKind(q, 'videos'));

  // A pasted YouTube / YouTube Music link opens that video together with its radio mix.
  function parseLink(value) {
    const raw = String(value || '').trim();
    if (!/^(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)\//i.test(raw)) return null;
    let url;
    try { url = new URL(/^https?:/i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
    const host = url.hostname.replace(/^(?:www|m|music)\./, '').toLowerCase();
    const videoId = host === 'youtu.be'
      ? url.pathname.slice(1, 12)
      : url.searchParams.get('v') || (/^\/(?:shorts|embed|live)\/([\w-]{11})/.exec(url.pathname) || [])[1] || '';
    const list = url.searchParams.get('list') || '';
    return /^[\w-]{11}$/.test(videoId) ? { videoId, list: /^[\w-]{10,80}$/.test(list) ? list : '' } : null;
  }

  // ---------- Matching a search query against artist names ----------
  const words = (s) => radioText(s).replace(/[^a-z0-9]+/g, ' ').trim() || String(s || '').toLowerCase().trim();
  function similarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      let diagonal = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const above = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
        diagonal = above;
      }
    }
    return 1 - row[b.length] / Math.max(a.length, b.length);
  }
  function relevance(query, name) {
    const q = words(query);
    const n = words(name);
    if (!q || !n) return 0;
    if (q === n) return 1;
    if (n.length >= 3 && ` ${q} `.includes(` ${n} `)) return 0.9;
    if (` ${n} `.includes(` ${q} `)) return 0.85;
    const nameWords = n.split(' ');
    if (q.length >= 3 && q.split(' ').every((w) => nameWords.some((x) => x.startsWith(w)))) return 0.78;
    const close = similarity(q, n);
    return close >= 0.8 ? close * 0.85 : 0;
  }
  // Only artists whose name matches the query are shown, so a song search does not drag in unrelated artists.
  function rank(query, artists, songs) {
    const hot = new Set((songs || []).slice(0, 3).map((t) => t.artistId).filter(Boolean));
    return (artists || [])
      .map((artist, index) => {
        const base = relevance(query, artist.name);
        return { artist, index, score: base >= MIN_SCORE && hot.has(artist.browseId) ? base + 0.1 : base };
      })
      .filter((x) => x.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((x) => x.artist);
  }

  // ---------- Recent searches ----------
  const recents = () => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY)); return Array.isArray(v) ? v.slice(0, 8) : []; } catch { return []; } };
  function remember(q) {
    const next = [q, ...recents().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage full */ }
  }

  // ---------- Search ----------
  async function openLink(link, q) {
    const id = ++searchSeq;
    searchState = { q, results: null, artists: [], albums: [], videos: [], loading: true, error: '', link: true };
    view = 'search';
    viewArg = q;
    renderAll();
    let results = null;
    let error = '';
    try {
      const seed = { videoId: link.videoId, playlistId: link.list || `RD${link.videoId}`, params: '' };
      const tracks = (await getRadio(seed)).map(toTrack);
      const first = tracks.find((t) => t.videoId === link.videoId) || tracks[0];
      if (!first) throw new Error('Za to povezavo ni skladb.');
      results = [first, ...tracks.filter((t) => t !== first)];
    } catch (e) { error = friendlyError(e); }
    if (id !== searchSeq) return;
    searchState = { q, results, artists: [], albums: [], videos: [], loading: false, error, link: true };
    if (view === 'search' && searchState.q === q) render();
  }

  async function search(q) {
    const link = parseLink(q);
    if (link) { await openLink(link, q); return; }
    const id = ++searchSeq;
    searchState = { q, results: null, artists: null, albums: null, videos: null, loading: !!q, error: '' };
    view = 'search';
    viewArg = q;
    if (q && document.activeElement !== $('#q')) $('#q').value = q;
    renderAll();
    if (!q) return;
    if (!navigator.onLine) {
      searchState = { ...searchState, loading: false, error: 'Brez povezave.' };
      render();
      return;
    }
    const [songs, artists, albums, videos] = await Promise.allSettled([ytSearch(q), findArtists(q), findAlbums(q), findVideos(q)]);
    if (id !== searchSeq) return;
    searchState = {
      q,
      loading: false,
      results: songs.status === 'fulfilled' ? songs.value : null,
      artists: artists.status === 'fulfilled' ? artists.value : [],
      albums: albums.status === 'fulfilled' ? albums.value : [],
      videos: videos.status === 'fulfilled' ? videos.value : [],
      error: songs.status === 'rejected' ? friendlyError(songs.reason) : '',
    };
    if (songs.status === 'fulfilled' && songs.value.length) remember(q);
    if (view === 'search' && searchState.q === q) render();
  }

  // ---------- Navigation ----------
  function openArtist(a) {
    const browseId = typeof a === 'string' ? a : a?.browseId;
    if (!browseId) return;
    view = 'artist';
    viewArg = { browseId, name: a?.name || '', cover: a?.cover || '' };
    renderAll();
  }
  function openAlbum(a) {
    if (!a?.browseId) return;
    view = 'album';
    viewArg = { browseId: a.browseId, title: a.title || '', cover: a.cover || '' };
    renderAll();
  }
  // Tracks saved before artist links existed only carry the artist's name, so look the artist up first.
  async function openArtistByName(name) {
    const query = String(name || '').trim();
    if (!query) return;
    try {
      const best = rank(query, await findArtists(query), [])[0];
      if (best) { openArtist(best); return; }
    } catch (error) { console.warn('Artist lookup failed:', error); }
    search(query);
  }
  function artistLink(track) {
    if (track.type !== 'yt' || !track.artist) return track.artist || '';
    return h('button', {
      class: 'artist-link', type: 'button', title: 'Odpri izvajalca',
      onclick: (event) => {
        event.stopPropagation();
        if (track.artistId) openArtist({ browseId: track.artistId, name: track.artist });
        else openArtistByName(track.artist);
      },
    }, track.artist);
  }

  // ---------- Following ----------
  const isFollowing = (id) => (db.followedArtists || []).some((a) => a.browseId === id);
  function toggleFollow(p) {
    const list = db.followedArtists = db.followedArtists || [];
    const index = list.findIndex((a) => a.browseId === p.browseId);
    if (index >= 0) {
      list.splice(index, 1);
      toast('Izvajalcu ne slediš več.');
    } else {
      list.unshift({ browseId: p.browseId, name: p.name, cover: p.cover || '' });
      toast('Slediš izvajalcu.');
    }
    save();
    render();
  }

  // ---------- Playing ----------
  async function playArtist(p, shuffleIt) {
    const seed = p.play || p.mix;
    let tracks = [];
    if (seed) {
      try { tracks = (await getRadio(seed)).map(toTrack); } catch (error) { console.warn('Artist radio failed:', error); }
    }
    if (!tracks.length) tracks = (p.shelves.find((s) => s.kind === 'songs')?.items || []).map(toTrack);
    if (!tracks.length) { toast('Za tega izvajalca ni skladb.'); return; }
    const list = shuffleIt ? shuffled(tracks) : tracks;
    playFrom(list, list[0]);
  }
  async function playArtistById(id, shuffleIt) {
    try { await playArtist(await getPage(id), shuffleIt); } catch (error) { toast(friendlyError(error)); }
  }
  async function playAlbumById(id) {
    try {
      const tracks = (await getPage(id)).tracks.map(toTrack);
      if (tracks.length) playFrom(tracks, tracks[0]); else toast('Ni skladb.');
    } catch (error) { toast(friendlyError(error)); }
  }
  async function fetchRadioMix(m) {
    try {
      let seed = m.radio;
      if (!seed && m.browseId) {
        const p = await getPage(m.browseId);
        seed = p.mix || p.play;
      }
      const tracks = seed ? (await getRadio(seed)).map(toTrack) : [];
      if (!tracks.length) throw new Error('Za ta miks ni skladb.');
      return tracks;
    } catch (error) { throw new Error(friendlyError(error)); }
  }
  function saveAsPlaylist(p) {
    db.playlists.push({ id: rid(), name: p.title, tracks: p.tracks.map(toTrack) });
    save();
    renderSidebar();
    toast(`Seznam "${p.title}" je shranjen.`);
  }

  // ---------- Components ----------
  const avatar = (a, size = '') => coverEl({ cover: a.cover, title: a.name || a.title || '' }, `artist-avatar ${size}`.trim());
  const artistChip = (a) => h('div', {
    class: 'artist-chip', role: 'link', tabindex: '0', title: a.name,
    onclick: () => openArtist(a), onkeydown: onEnter(() => openArtist(a)),
  }, avatar(a), h('b', {}, a.name), a.listeners || a.subtitle ? h('small', {}, a.listeners || a.subtitle) : null);
  const artistRow = (list) => h('div', { class: 'artist-chips' }, list.map(artistChip));

  function artistTop(a) {
    const stop = (fn) => (event) => { event.stopPropagation(); fn(); };
    return h('div', {
      class: 'artist-top', role: 'link', tabindex: '0',
      onclick: () => openArtist(a), onkeydown: onEnter(() => openArtist(a)),
    },
    avatar(a, 'xl'),
    h('div', { class: 'artist-top-info' },
      h('span', { class: 'eyebrow' }, 'IZVAJALEC'),
      h('b', {}, a.name),
      a.listeners ? h('small', {}, a.listeners) : null,
      h('div', { class: 'artist-top-actions' },
        h('button', { class: 'btn', type: 'button', onclick: stop(() => playArtistById(a.browseId, false)) }, '▶ Predvajaj'),
        h('button', { class: 'btn sec', type: 'button', onclick: stop(() => openArtist(a)) }, 'Odpri izvajalca'))));
  }

  function albumCard(a) {
    const open = () => openAlbum(a);
    const fab = h('button', { class: 'playfab', type: 'button', 'aria-label': 'Predvajaj', onclick: (event) => { event.stopPropagation(); playAlbumById(a.browseId); } }, '▶');
    return h('div', { class: 'card album-card', role: 'link', tabindex: '0', onclick: open, onkeydown: onEnter(open) },
      coverEl({ cover: a.cover, title: a.title }, 'cover'), fab,
      h('div', { class: 'ct', title: a.title }, a.title),
      h('div', { class: 'ca' }, [a.type, a.artist, a.year].filter(Boolean).join(' • ') || a.subtitle || ''));
  }

  const videoCard = (item, list) => {
    const track = list.find((t) => t.videoId === item.videoId);
    return h('div', { class: 'card video-card', onclick: () => playFrom(list, track) },
      h('div', { class: 'video-thumb' }, coverEl(track, 'cover'), h('button', { class: 'playfab', type: 'button', 'aria-label': 'Predvajaj' }, '▶')),
      h('div', { class: 'ct', title: item.title }, item.title),
      h('div', { class: 'ca' }, [item.artist, item.views].filter(Boolean).join(' • ')));
  };

  const failureBlock = (message, retry) => h('div', { class: 'load-error' },
    h('b', {}, 'Nalaganje ni uspelo'),
    h('p', {}, message),
    h('div', { class: 'toolbar' }, btn('Poskusi znova', retry, 'btn'), btn('Nazaj', () => navGo(-1), 'btn sec')));

  const skeletonRows = (n) => Array.from({ length: n }, () => h('div', { class: 'row trow skel-row' },
    h('i', { class: 'skel dot' }), h('i', { class: 'skel sq' }),
    h('div', {}, h('i', { class: 'skel line' }), h('i', { class: 'skel line short' }))));

  // ---------- Search results ----------
  function idleView() {
    const lately = recents();
    const followed = db.followedArtists || [];
    return h('div', {},
      h('div', { class: 'note' }, 'Vpiši iskalni niz zgoraj in pritisni Enter.'),
      h('div', { class: 'note' }, 'Najdeš skladbe, izvajalce, albume in videoposnetke. Lahko tudi prilepiš povezavo YouTube.'),
      lately.length ? [
        sectionHead('Nedavna iskanja'),
        h('div', { class: 'chips' },
          ...lately.map((q) => h('button', { class: 'chip', onclick: () => { $('#q').value = q; search(q); } }, q)),
          h('button', { class: 'chip ghost', onclick: () => { try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ } render(); } }, 'Počisti')),
      ] : null,
      followed.length ? [sectionHead('Tvoji izvajalci'), artistRow(followed)] : null);
  }

  function linkView() {
    const { q, error, results } = searchState;
    const out = [hero(h('h2', {}, 'Povezava YouTube'), h('div', { class: 'note' }, 'Skladba iz povezave in miks podobnih skladb.'))];
    if (error) out.push(failureBlock(error, () => search(q)));
    if (results?.length) {
      out.push(h('div', { class: 'toolbar' },
        btn('▶ Predvajaj', () => playFrom(results, results[0]), 'btn'),
        btn('Premešaj', () => { const mixed = shuffled(results); playFrom(mixed, mixed[0]); }, 'btn sec')),
      ...trackRows(results, '', null, { showAlbum: false }));
    }
    return out;
  }

  function searchView() {
    const { q, loading, error, results, artists, albums, videos, link } = searchState;
    const out = [hero(h('h2', {}, q ? `Rezultati: ${q}` : 'Iskanje'))];
    if (!q) return [...out, idleView()];
    if (loading) {
      return [...out,
        h('div', { class: 'artist-top skel-top' }, h('i', { class: 'skel avatar' }), h('div', { class: 'artist-top-info' }, h('i', { class: 'skel line' }), h('i', { class: 'skel line short' }))),
        ...skeletonRows(6)];
    }
    if (link) return linkView();
    const found = rank(q, artists, results);
    const lower = q.toLowerCase();
    const local = db.library.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(lower));
    if (error) out.push(failureBlock(error, () => search(q)));
    if (found.length) {
      out.push(h('section', { class: 'artist-block' },
        artistTop(found[0]),
        found.length > 1 ? h('div', { class: 'artist-more' }, h('h4', {}, 'Več izvajalcev'), artistRow(found.slice(1, 9))) : null));
    }
    if (local.length) out.push(sectionHead('V knjižnici'), ...local.map((t) => trackRow(t, local)));
    if (results) {
      out.push(sectionHead('Skladbe'));
      if (results.length) {
        out.push(h('div', { class: 'toolbar' },
          btn('▶ Predvajaj', () => playFrom(results, results[0]), 'btn'),
          btn('Premešaj', () => { const mixed = shuffled(results); playFrom(mixed, mixed[0]); }, 'btn sec')));
      }
      out.push(...trackRows(results, 'Ni rezultatov.'));
    }
    const songIds = new Set((results || []).map((t) => t.videoId));
    const clips = (videos || []).filter((v) => !songIds.has(v.videoId)).slice(0, 12).map(toTrack);
    if (clips.length) out.push(sectionHead('Videoposnetki', 'Videospoti in posnetki, ki niso med skladbami.'), ...trackRows(clips, '', null, { showAlbum: false }));
    if (albums?.length) out.push(sectionHead('Albumi'), h('div', { class: 'grid' }, albums.slice(0, 14).map(albumCard)));
    return out;
  }

  // ---------- Artist and album pages ----------
  const isCurrent = (id) => (view === 'artist' || view === 'album') && viewArg?.browseId === id;
  function pageView(kind, build) {
    const id = viewArg?.browseId;
    const ready = peek(pages, id, PAGE_TTL);
    if (ready) return build(ready);
    const failed = failures.get(id);
    if (failed) return [hero(h('h2', {}, viewArg?.name || viewArg?.title || '')), failureBlock(failed, () => { failures.delete(id); render(); })];
    getPage(id).then(() => { if (isCurrent(id)) render(); }, (error) => {
      failures.set(id, friendlyError(error));
      if (isCurrent(id)) render();
    });
    const hint = viewArg || {};
    if (kind === 'artist') {
      return [h('div', { class: 'hero artist-hero' },
        h('div', { class: 'artist-hero-body' },
          hint.cover ? avatar({ cover: hint.cover, name: hint.name }, 'xxl') : h('i', { class: 'skel avatar xxl' }),
          h('div', { class: 'artist-hero-text' },
            h('span', { class: 'eyebrow' }, 'IZVAJALEC'),
            hint.name ? h('h2', {}, hint.name) : h('i', { class: 'skel line wide' })))),
      ...skeletonRows(5)];
    }
    return [h('div', { class: 'hero' }, h('div', { class: 'pl-head' },
      hint.cover ? coverEl({ cover: hint.cover, title: hint.title }, 'pl-icon') : h('i', { class: 'skel pl-icon' }),
      h('div', {}, h('small', {}, 'ALBUM'), hint.title ? h('h2', {}, hint.title) : h('i', { class: 'skel line wide' })))),
    ...skeletonRows(8)];
  }

  function artistPageView(p) {
    const songShelf = p.shelves.find((s) => s.kind === 'songs');
    const top = (songShelf?.items || []).map(toTrack);
    const following = isFollowing(p.browseId);
    const stats = [p.listeners, p.subscribers ? `${p.subscribers} naročnikov` : ''].filter(Boolean).join(' · ');
    const out = [h('div', { class: 'hero artist-hero' },
      p.cover ? h('div', { class: 'artist-hero-bg', style: `background-image:url("${cssUrl(p.cover)}")` }) : null,
      h('div', { class: 'artist-hero-body' },
        avatar(p, 'xxl'),
        h('div', { class: 'artist-hero-text' },
          h('span', { class: 'eyebrow' }, 'IZVAJALEC'),
          h('h2', {}, p.name),
          stats ? h('div', { class: 'artist-stats' }, stats) : null)),
      h('div', { class: 'toolbar artist-actions' },
        btn('▶ Predvajaj', () => playArtist(p, false), 'btn'),
        btn('Premešaj', () => playArtist(p, true), 'btn sec'),
        p.mix || p.play ? btn('Miks', () => openMix(artistMix(p)), 'btn sec') : null,
        btn(following ? 'Slediš' : 'Sledi', () => toggleFollow(p), following ? 'btn sec following' : 'btn sec')))];
    if (top.length) {
      out.push(sectionHead(songShelf.title || 'Najbolj priljubljene skladbe'), ...trackRows(top, ''));
      if (songShelf.more) {
        out.push(h('div', { class: 'toolbar' }, btn('Prikaži vse skladbe', () => openAlbum({ browseId: songShelf.more, title: `${p.name}: skladbe`, cover: p.cover }), 'btn sec')));
      }
    }
    const mixes = [
      p.mix ? artistMix(p) : null,
      p.play ? { key: `ar:${p.browseId}:top`, title: `Najboljše od ${p.name}`, sub: 'Skladbe izvajalca', radio: p.play, cover: p.cover } : null,
    ].filter(Boolean);
    if (mixes.length) out.push(sectionHead('Miksi', 'Radio izvajalca in njegove skladbe v enem kliku.'), h('div', { class: 'grid' }, mixes.map(mixCard)));
    for (const shelf of p.shelves) {
      if (shelf.kind === 'songs') continue;
      out.push(sectionHead(shelf.title));
      if (shelf.kind === 'videos') {
        const list = shelf.items.map(toTrack);
        out.push(h('div', { class: 'grid video-grid' }, shelf.items.map((item) => videoCard(item, list))));
      } else if (shelf.kind === 'artists') out.push(artistRow(shelf.items));
      else out.push(h('div', { class: 'grid' }, shelf.items.map(albumCard)));
    }
    if (p.description) {
      const about = h('div', { class: 'artist-about clamped' }, p.description);
      const more = h('button', { class: 'btn sec', type: 'button' }, 'Več');
      more.onclick = () => { const open = about.classList.toggle('clamped'); more.textContent = open ? 'Več' : 'Manj'; };
      out.push(sectionHead('O izvajalcu'), about, p.description.length > 220 ? more : null);
    }
    if (p.play) setTimeout(() => getRadio(p.play).catch(() => {}), 250);
    return out;
  }

  function albumPageView(p) {
    const tracks = p.tracks.map(toTrack);
    const label = (p.subtitle.split(' • ')[0] || (p.kind === 'album' ? 'Album' : 'Seznam')).toUpperCase();
    const year = (p.subtitle.match(/\b(19|20)\d{2}\b/) || [])[0];
    const byline = h('div', { class: 'note album-meta' },
      p.artist ? (p.artistId ? h('button', { class: 'artist-link', type: 'button', onclick: () => openArtist({ browseId: p.artistId, name: p.artist }) }, p.artist) : p.artist) : null,
      [year, p.meta].filter(Boolean).map((part) => ` · ${part}`));
    return [
      hero(h('div', { class: 'pl-head' },
        coverEl({ cover: p.cover, title: p.title }, 'pl-icon'),
        h('div', {}, h('small', {}, label), h('h2', {}, p.title), byline))),
      h('div', { class: 'toolbar' },
        btn('▶ Predvajaj', () => tracks.length && playFrom(tracks, tracks[0]), 'btn'),
        btn('Premešaj', () => { const mixed = shuffled(tracks); if (mixed.length) playFrom(mixed, mixed[0]); }, 'btn sec'),
        btn('Shrani kot seznam', () => saveAsPlaylist(p), 'btn sec')),
      ...trackRows(tracks, 'Ni skladb.', null, { showAlbum: p.kind !== 'album' }),
    ];
  }

  return {
    search,
    searchView,
    artistView: () => pageView('artist', artistPageView),
    albumView: () => pageView('album', albumPageView),
    open: openArtist,
    openByName: openArtistByName,
    openAlbum,
    link: artistLink,
    row: artistRow,
    fetchRadioMix,
    isFollowing,
    toTrack,
    parseLink,
    relevance,
  };
})();

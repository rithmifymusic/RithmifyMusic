'use strict';

// Unofficial YouTube Music (InnerTube) client: search, artist and album pages and radio mixes.
// It needs no API key, but the endpoints are undocumented and may be rate-limited or change.

const CLIENT = { clientName: 'WEB_REMIX', clientVersion: '1.20240918.01.00', hl: 'sl', gl: 'SI' };
const FILTERS = {
  songs: 'EgWKAQIIAWoKEAkQBRAKEAMQBA==',
  artists: 'EgWKAQIgAWoMEA4QChADEAQQCRAF',
  albums: 'EgWKAQIYAWoMEA4QChADEAQQCRAF',
  videos: 'EgWKAQIQAWoMEA4QChADEAQQCRAF',
};
const ARTIST = 'MUSIC_PAGE_TYPE_ARTIST';
const ALBUM = 'MUSIC_PAGE_TYPE_ALBUM';
const PLAYLIST = 'MUSIC_PAGE_TYPE_PLAYLIST';
const GREYED_OUT = 'MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT';
const VIDEO_ID = /^[\w-]{11}$/;
const BROWSE_ID = /^(?:UC[\w-]{20,40}|MPREb_[\w-]{6,40}|VL[\w-]{10,64})$/;
const SEPARATOR = ' • ';
const CONTINUATION_PAGES = 2;

async function request(endpoint, body) {
  const response = await fetch(`https://music.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://music.youtube.com', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ context: { client: CLIENT }, ...body }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`InnerTube ${response.status}`);
  return response.json();
}

const text = (value) => (value?.runs || []).map((run) => run.text || '').join('');
const endpointOf = (run) => run?.navigationEndpoint?.browseEndpoint || null;
const pageTypeOf = (endpoint) => endpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || '';

function seconds(value) {
  const match = /^(?:(\d+):)?(\d+):(\d+)$/.exec(String(value || '').trim());
  return match ? (+match[1] || 0) * 3600 + +match[2] * 60 + +match[3] : 0;
}

// Square thumbnails can be resized through the URL; video thumbnails are returned unchanged.
function image(renderer, size) {
  const list = renderer?.musicThumbnailRenderer?.thumbnail?.thumbnails || renderer?.thumbnails || [];
  const url = list[list.length - 1]?.url || '';
  if (!url.startsWith('https://')) return '';
  return size ? url.replace(/=w\d+-h\d+.*$/, `=w${size}-h${size}`) : url;
}

function linksIn(runs) {
  const artists = [];
  let album = null;
  for (const run of runs || []) {
    const endpoint = endpointOf(run);
    if (!endpoint?.browseId) continue;
    const type = pageTypeOf(endpoint);
    if (type === ARTIST) artists.push({ id: endpoint.browseId, name: run.text || '' });
    else if (type === ALBUM && !album) album = { id: endpoint.browseId, name: run.text || '' };
  }
  return { artists, album };
}

function rowTrack(item, fallback = {}) {
  const row = item?.musicResponsiveListItemRenderer;
  if (!row || row.musicItemRendererDisplayPolicy === GREYED_OUT) return null;
  const videoId = row.playlistItemData?.videoId
    || row.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
  const columns = (row.flexColumns || []).map((column) => column.musicResponsiveListItemFlexColumnRenderer?.text);
  const title = text(columns[0]);
  if (!VIDEO_ID.test(videoId || '') || !title) return null;
  const { artists, album } = linksIn(columns.slice(1).flatMap((column) => column?.runs || []));
  const byline = text(columns[1]).split(SEPARATOR);
  const own = (byline[0] || '').trim();
  const duration = text(row.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text);
  return {
    videoId,
    title,
    artist: own || fallback.artist || '',
    artistId: own ? artists[0]?.id || '' : fallback.artistId || '',
    album: album?.name || fallback.album || '',
    albumId: album?.id || fallback.albumId || '',
    seconds: seconds(duration) || seconds(byline[byline.length - 1]),
    cover: image(row.thumbnail, 226) || fallback.cover || '',
  };
}

function panelTrack(item) {
  const video = item?.playlistPanelVideoRenderer || item?.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;
  const title = text(video?.title);
  if (!VIDEO_ID.test(video?.videoId || '') || !title) return null;
  const { artists, album } = linksIn(video.longBylineText?.runs);
  return {
    videoId: video.videoId,
    title,
    artist: text(video.longBylineText).split(SEPARATOR)[0].trim(),
    artistId: artists[0]?.id || '',
    album: album?.name || '',
    albumId: album?.id || '',
    seconds: seconds(text(video.lengthText)),
    cover: image(video.thumbnail, 226),
  };
}

// Carousel entries on artist pages: albums, singles, videos, playlists and related artists.
function carouselItem(item) {
  const entry = item?.musicTwoRowItemRenderer;
  const title = text(entry?.title);
  if (!title) return null;
  const subtitle = text(entry.subtitle);
  const browse = entry.navigationEndpoint?.browseEndpoint;
  const watch = entry.navigationEndpoint?.watchEndpoint;
  const type = pageTypeOf(browse);
  if (browse?.browseId && type === ALBUM) return { kind: 'album', browseId: browse.browseId, title, subtitle, cover: image(entry.thumbnailRenderer, 400) };
  if (browse?.browseId && type === ARTIST) return { kind: 'artist', browseId: browse.browseId, name: title, subtitle, cover: image(entry.thumbnailRenderer, 300) };
  if (browse?.browseId && type === PLAYLIST) return { kind: 'playlist', browseId: browse.browseId, title, subtitle, cover: image(entry.thumbnailRenderer, 400) };
  if (VIDEO_ID.test(watch?.videoId || '')) {
    const parts = subtitle.split(SEPARATOR);
    return {
      kind: 'video',
      videoId: watch.videoId,
      title,
      artist: (parts[0] || '').trim(),
      artistId: linksIn(entry.subtitle?.runs).artists[0]?.id || '',
      views: (parts[1] || '').trim(),
      cover: image(entry.thumbnailRenderer),
    };
  }
  return null;
}

const searchShelves = (response) => (response.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [])
  .map((section) => section.musicShelfRenderer).filter(Boolean);

async function search(query) {
  const term = String(query || '').trim().slice(0, 200);
  if (!term) return [];
  const response = await request('search', { query: term, params: FILTERS.songs });
  return searchShelves(response).flatMap((shelf) => shelf.contents || []).map((item) => rowTrack(item)).filter(Boolean);
}

async function searchKind(query, kind) {
  const params = kind === 'artists' || kind === 'albums' || kind === 'videos' ? FILTERS[kind] : '';
  const term = String(query || '').trim().slice(0, 200);
  if (!params || !term) return [];
  const response = await request('search', { query: term, params });
  const out = [];
  for (const item of searchShelves(response).flatMap((shelf) => shelf.contents || [])) {
    const row = item.musicResponsiveListItemRenderer;
    const endpoint = row?.navigationEndpoint?.browseEndpoint;
    const columns = (row?.flexColumns || []).map((column) => column.musicResponsiveListItemFlexColumnRenderer?.text);
    const title = text(columns[0]);
    const parts = text(columns[1]).split(SEPARATOR).map((part) => part.trim()).filter(Boolean);
    if (kind === 'videos') {
      // Music videos and uploads that have no catalogue song (so they never show up under "songs").
      const track = rowTrack(item);
      if (track) out.push({ ...track, views: parts.length >= 3 ? parts[1] : '' });
      continue;
    }
    if (!endpoint?.browseId || !title) continue;
    const type = pageTypeOf(endpoint);
    if (kind === 'artists' && type === ARTIST) {
      out.push({ browseId: endpoint.browseId, name: title, listeners: parts.slice(1).join(SEPARATOR), cover: image(row.thumbnail, 300) });
    } else if (kind === 'albums' && type === ALBUM) {
      out.push({
        browseId: endpoint.browseId,
        title,
        type: parts[0] || '',
        artist: parts[1] || '',
        artistId: linksIn(columns[1]?.runs).artists[0]?.id || '',
        year: parts.find((part) => /^\d{4}$/.test(part)) || '',
        cover: image(row.thumbnail, 400),
      });
    }
  }
  return out;
}

function artistPage(response, browseId) {
  const header = response.header?.musicImmersiveHeaderRenderer || response.header?.musicVisualHeaderRenderer || {};
  const name = text(header.title);
  if (!name) throw new Error('Izvajalca ni mogoče naložiti.');
  const seed = (button) => {
    const watch = button?.buttonRenderer?.navigationEndpoint?.watchEndpoint;
    return watch?.videoId && watch.playlistId ? { videoId: watch.videoId, playlistId: watch.playlistId, params: watch.params || '' } : null;
  };
  const page = {
    kind: 'artist',
    browseId,
    name,
    description: text(header.description),
    listeners: text(header.monthlyListenerCount),
    subscribers: text(header.subscriptionButton?.subscribeButtonRenderer?.subscriberCountText),
    cover: image(header.thumbnail, 544),
    play: seed(header.playButton),
    mix: seed(header.startRadioButton),
    shelves: [],
  };
  const sections = response.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
  for (const section of sections) {
    if (section.musicShelfRenderer) {
      const shelf = section.musicShelfRenderer;
      const items = (shelf.contents || []).map((item) => rowTrack(item, { artist: name, artistId: browseId })).filter(Boolean);
      const more = shelf.bottomEndpoint?.browseEndpoint?.browseId || endpointOf(shelf.title?.runs?.[0])?.browseId || '';
      if (items.length) page.shelves.push({ kind: 'songs', title: text(shelf.title), items, more: more.startsWith('VL') ? more : '' });
    } else if (section.musicCarouselShelfRenderer) {
      const carousel = section.musicCarouselShelfRenderer;
      const items = (carousel.contents || []).map(carouselItem).filter(Boolean);
      const title = text(carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title);
      if (items.length && title) page.shelves.push({ kind: `${items[0].kind}s`, title, items: items.filter((item) => item.kind === items[0].kind) });
    } else if (section.musicDescriptionShelfRenderer && !page.description) {
      page.description = text(section.musicDescriptionShelfRenderer.description);
    }
  }
  return page;
}

const continuationToken = (items) => items.find((item) => item.continuationItemRenderer)
  ?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token || '';

async function collectionPage(response, browseId) {
  const isAlbum = browseId.startsWith('MPREb_');
  const content = response.contents?.twoColumnBrowseResultsRenderer;
  const top = content?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0] || {};
  const header = top.musicResponsiveHeaderRenderer || top.musicEditablePlaylistDetailHeaderRenderer?.header?.musicResponsiveHeaderRenderer || {};
  const micro = response.microformat?.microformatDataRenderer || {};
  const title = text(header.title) || micro.title || '';
  if (!title) throw new Error('Seznama skladb ni mogoče naložiti.');
  const artist = text(header.straplineTextOne);
  const artistId = linksIn(header.straplineTextOne?.runs).artists[0]?.id || '';
  const cover = image(header.thumbnail, 544) || image(micro.thumbnail, 544);
  const fallback = { artist, artistId, cover, ...(isAlbum ? { album: title, albumId: browseId } : {}) };
  const shelf = (content?.secondaryContents?.sectionListRenderer?.contents || [])
    .map((section) => section.musicShelfRenderer || section.musicPlaylistShelfRenderer).find(Boolean);
  let items = shelf?.contents || [];
  const tracks = items.map((item) => rowTrack(item, fallback)).filter(Boolean);
  let token = continuationToken(items);
  for (let page = 0; page < CONTINUATION_PAGES && token; page += 1) {
    try {
      const next = await request('browse', { continuation: token });
      items = next.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems || [];
    } catch { break; }
    tracks.push(...items.map((item) => rowTrack(item, fallback)).filter(Boolean));
    token = continuationToken(items);
  }
  return {
    kind: isAlbum ? 'album' : 'playlist',
    browseId,
    title,
    subtitle: text(header.subtitle) || micro.description || '',
    artist,
    artistId,
    meta: text(header.secondSubtitle),
    cover,
    tracks,
  };
}

async function browse(browseId) {
  const id = String(browseId || '');
  if (!BROWSE_ID.test(id)) throw new Error('Neveljavna povezava.');
  const response = await request('browse', { browseId: id });
  return id.startsWith('UC') ? artistPage(response, id) : collectionPage(response, id);
}

async function radio(seed = {}) {
  const videoId = String(seed.videoId || '');
  const playlistId = String(seed.playlistId || '');
  const params = String(seed.params || '');
  if (!VIDEO_ID.test(videoId) || !/^[\w-]{10,80}$/.test(playlistId) || !/^[\w%=-]{0,200}$/.test(params)) throw new Error('Neveljaven miks.');
  const response = await request('next', { videoId, playlistId, ...(params ? { params } : {}), isAudioOnly: true });
  const queue = response.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer
    ?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents || [];
  const seen = new Set();
  return queue.map(panelTrack).filter((track) => track && !seen.has(track.videoId) && seen.add(track.videoId));
}

module.exports = { search, searchKind, browse, radio };

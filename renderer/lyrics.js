// Synced lyrics (Spotify-style): side panel preview and full-screen view.
const lyricsCache = new Map();

function parseLrc(text) {
  const lines = [];
  for (const row of String(text || '').split(/\r?\n/)) {
    const m = row.match(/^((?:\[\d+:\d+(?:[.:]\d+)?\])+)\s*(.*)$/);
    if (!m) continue;
    for (const tag of m[1].match(/\[(\d+):(\d+)(?:[.:](\d+))?\]/g)) {
      const p = tag.match(/\[(\d+):(\d+)(?:[.:](\d+))?\]/);
      const frac = p[3] ? Number(`0.${p[3]}`) : 0;
      lines.push({ t: Number(p[1]) * 60 + Number(p[2]) + frac, text: m[2].trim() });
    }
  }
  return lines.sort((a, b) => a.t - b.t);
}

function ensureLyrics(track) {
  if (!track || track.type === 'radio') return Promise.resolve(null);
  if (!lyricsCache.has(track.id)) {
    const p = window.gmajna.getLyrics({ title: track.title, artist: track.artist, duration: getDur() || track.seconds || 0 })
      .then((r) => (r ? { lines: parseLrc(r.synced), plain: r.plain || '' } : null))
      .catch(() => null);
    lyricsCache.set(track.id, p);
    p.then((r) => { if (!r) lyricsCache.delete(track.id); });
  }
  return lyricsCache.get(track.id);
}

function fillLyricsBox(box, track) {
  box.dataset.id = track.id;
  box._lines = null;
  box._active = -1;
  box.replaceChildren(h('div', { class: 'lnote' }, 'Iščem besedilo …'));
  ensureLyrics(track).then((data) => {
    if (!box.isConnected || box.dataset.id !== track.id) return;
    const own = (db.lyrics && db.lyrics[track.id]) || '';
    if (data && data.lines.length) {
      box._lines = data.lines;
      box.replaceChildren(...data.lines.map((l, i) => h('div', {
        class: 'll', 'data-i': String(i), onclick: () => engineSeek(l.t),
      }, l.text || '♪')));
      box.scrollTop = 0;
    } else if (own || (data && data.plain)) {
      box.replaceChildren(...(own || data.plain).split(/\r?\n/).map((t) => h('div', { class: 'lp' }, t || ' ')));
    } else {
      box.replaceChildren(h('div', { class: 'lnote' }, 'Besedilo ni najdeno.'));
    }
  });
}

function lyricsBox(extraClass) {
  const box = h('div', { class: `lyrics-box ${extraClass || ''}` });
  if (cur) fillLyricsBox(box, cur);
  return box;
}

function tickLyrics() {
  for (const box of document.querySelectorAll('.lyrics-box')) {
    if (cur && box.dataset.id !== cur.id) { fillLyricsBox(box, cur); continue; }
    const lines = box._lines;
    if (!lines) continue;
    const pos = getPos() + 0.25;
    let idx = -1;
    for (let i = 0; i < lines.length && lines[i].t <= pos; i++) idx = i;
    if (idx === box._active) continue;
    box._active = idx;
    const nodes = box.children;
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle('on', i === idx);
      nodes[i].classList.toggle('past', i < idx);
    }
    const el = nodes[idx];
    if (el) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2, behavior: 'smooth' });
  }
}
setInterval(tickLyrics, 250);

function closeLyricsFull() {
  document.getElementById('lyrics-full')?.remove();
}
function openLyricsFull() {
  closeLyricsFull();
  if (!cur) return;
  const top = h('div', { class: 'lf-top' },
    h('div', {}, h('div', { class: 'lf-title' }, cur.title), h('div', { class: 'lf-artist' }, cur.artist)),
    h('button', { class: 'lf-close', title: 'Zapri', onclick: closeLyricsFull }, '✕'));
  const overlay = h('div', { id: 'lyrics-full' }, top, lyricsBox('lf-box'));
  document.body.append(overlay);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLyricsFull(); });

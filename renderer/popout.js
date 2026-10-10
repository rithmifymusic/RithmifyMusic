'use strict';

const $ = (selector) => document.querySelector(selector);
const playerIcon = (name) => name === 'pause'
  ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5h3.5v13H7zm6.5 0H17v13h-3.5z"/></svg>'
  : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.3v13.4L18.6 12z"/></svg>';
const fmt = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
};
let latest = null;
let seeking = false;
let volumeChanging = false;

function render(state) {
  if (!state) return;
  latest = state;
  document.documentElement.style.setProperty('--accent', state.accent || '#ff3d71');
  $('#title').textContent = state.title || 'Nič se ne predvaja';
  $('#artist').textContent = state.artist || '';
  $('#position').textContent = fmt(state.position);
  $('#duration').textContent = fmt(state.duration);
  if (!seeking) $('#seek').value = state.duration ? Math.round((state.position / state.duration) * 1000) : 0;
  if (!volumeChanging) $('#volume').value = Number.isFinite(state.volume) ? state.volume : 80;
  $('#toggle').innerHTML = playerIcon(state.playing ? 'pause' : 'play');
  $('#toggle').title = state.playing ? 'Pavza' : 'Predvajaj';
  $('#toggle').setAttribute('aria-label', state.playing ? 'Pavza' : 'Predvajaj');
  $('#shuffle').classList.toggle('active', !!state.shuffle);
  $('#repeat').classList.toggle('active', state.repeat !== 'off');
  $('#like').classList.toggle('active', !!state.liked);
  $('#like').textContent = state.liked ? '♥' : '♡';
  const cover = $('#cover');
  if (state.cover) {
    if (cover.src !== state.cover) cover.src = state.cover;
    cover.hidden = false;
  } else {
    cover.removeAttribute('src');
    cover.hidden = true;
  }
}

window.gmajna.onPopoutState(render);
window.gmajna.popoutCommand('state-request');

$('#toggle').addEventListener('click', () => window.gmajna.popoutCommand('toggle'));
$('#previous').addEventListener('click', () => window.gmajna.popoutCommand('previous'));
$('#next').addEventListener('click', () => window.gmajna.popoutCommand('next'));
$('#shuffle').addEventListener('click', () => window.gmajna.popoutCommand('shuffle'));
$('#repeat').addEventListener('click', () => window.gmajna.popoutCommand('repeat'));
$('#like').addEventListener('click', () => window.gmajna.popoutCommand('like'));
$('#add').addEventListener('click', () => window.gmajna.popoutCommand('add'));
$('#seek').addEventListener('input', (event) => {
  seeking = true;
  const duration = Number(latest?.duration) || 0;
  $('#position').textContent = fmt(duration * Number(event.target.value) / 1000);
});
$('#seek').addEventListener('change', (event) => {
  const duration = Number(latest?.duration) || 0;
  window.gmajna.popoutCommand('seek', duration * Number(event.target.value) / 1000);
  seeking = false;
});
$('#volume').addEventListener('input', (event) => {
  volumeChanging = true;
  window.gmajna.popoutCommand('volume', Number(event.target.value));
});
$('#volume').addEventListener('change', () => { volumeChanging = false; });
$('#close').addEventListener('click', () => window.gmajna.closePopout());

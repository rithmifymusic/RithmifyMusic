'use strict';

const $ = (selector) => document.querySelector(selector);
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
  $('#toggle').textContent = state.playing ? 'Ⅱ' : '▶';
  $('#toggle').title = state.playing ? 'Pavza' : 'Predvajaj';
  $('#toggle').setAttribute('aria-label', state.playing ? 'Pavza' : 'Predvajaj');
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

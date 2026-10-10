'use strict';

const $ = (s) => document.querySelector(s);
const COLORS = ['#1ed760', '#b388ff', '#ffc107', '#ff3d71', '#4cc3ff', '#ff8a3d'];

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(2)) if (kid != null && kid !== false) el.append(kid);
  return el;
}
const btn = (label, onclick, cls) => h('button', { onclick: () => onclick(), class: cls }, label);
const decode = (s) => new DOMParser().parseFromString(s, 'text/html').documentElement.textContent;
const fmt = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const svg = (d, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="currentColor"><path d="${d}"/></svg>`;
const ICON = {
  play: svg('M8 5v14l11-7z', 18),
  pause: svg('M6 5h4v14H6zm8 0h4v14h-4z', 18),
  prev: svg('M6 6h2v12H6zm3.5 6L18 18V6z'),
  next: svg('M16 6h2v12h-2zM6 18l8.5-6L6 6z'),
  shuffle: `<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor"><path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z M7.5 10.723l.98-1.167.957 1.14a2.25 2.25 0 0 0 1.724.804h1.947l-1.017-1.018a.75.75 0 1 1 1.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 1 1-1.06-1.06L13.109 13H11.16a3.75 3.75 0 0 1-2.873-1.34z"/></svg>`,
  smartShuffle: `<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor"><g transform="translate(3.2 3.2) scale(.8)"><path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z M7.5 10.723l.98-1.167.957 1.14a2.25 2.25 0 0 0 1.724.804h1.947l-1.017-1.018a.75.75 0 1 1 1.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 1 1-1.06-1.06L13.109 13H11.16a3.75 3.75 0 0 1-2.873-1.34z"/></g><path d="M3 0l.8 2.2L6 3l-2.2.8L3 6l-.8-2.2L0 3l2.2-.8z"/></svg>`,
  repeat: svg('M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z'),
  heart: svg('M12 21l-1.5-1.4C5.4 15 2 11.9 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.4-3.4 6.5-8.5 11.1z'),
  heartO: svg('M16.5 3c-1.7 0-3.4.8-4.5 2.1C10.9 3.8 9.2 3 7.5 3 4.4 3 2 5.4 2 8.5c0 3.4 3.4 6.5 8.5 11.1L12 21l1.5-1.4C18.6 15 22 11.900 22 8.500 22 5.400 19.600 3 16.500 3zm-4.400 15.500-.100.100-.100-.100C7.400 14.400 4 11.400 4 8.500 4 6.500 5.500 5 7.500 5c1.500 0 3 1 3.500 2.400h2C13.500 6 15 5 16.500 5c2 0 3.500 1.500 3.500 3.500 0 2.900-3.400 5.900-7.900 10z'),
  plus: svg('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z'),
  home: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 10.5 8.5-7 8.5 7"/><path d="M5.5 9v11h5v-6h3v6h5V9"/></svg>',
  radio: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11v2m4-5v8m4-11v14m4-10v6m4-8v10"/><path d="m5 4 14 3"/></svg>',
  viz: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 10v4m4-8v12m4-15v18m4-13v8m4-11v14m4-8v4"/></svg>',
  lyr: svg('M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11z'),
  now: svg('M3 4h18v12H3zm2 2v8h14V6zm4 14h6v2H9z'),
  queue: svg('M3 6h13v2H3zm0 5h13v2H3zm0 5h9v2H3zm15-5v7.200a2.800 2.800 0 1 0 2 2.600V13h3v-2z'),
  mini: svg('M14 3h7v7h-2V6.400l-5.300 5.300-1.400-1.400L17.600 5H14zM3 14h2v3.600l5.300-5.300 1.400 1.400L6.400 19H10v2H3z', 18),
};
const SI_RADIO_STATIONS = [
  { id: 'val202', name: 'Val 202', freq: '98.9 FM', style: 'Pop · rock · aktualno', group: 'Pop', color: '#f07043', stream: 'https://mp3.rtvslo.si/val202', page: 'https://siradio.si/val202/', logo: 'val202', bands: ['FM', 'DAB'] },
  { id: 'ena', name: 'Radio 1', freq: '89.7 FM', style: 'Največji hiti', group: 'Pop', color: '#ee4266', stream: 'https://live.radio.si/Radio1', page: 'https://siradio.si/ena/', logo: 'ena', bands: ['FM', 'DAB'] },
  { id: 'frajer', name: 'Radio Frajer', freq: 'Spletni radio', style: 'Domaci in tuji hiti', group: 'Domaca', color: '#cf5b47', stream: 'https://stream.nextmedia.si/proxy/frajer_1?mp=/frajer', page: 'https://radiofrajer.si/', logo: 'radio-frajer', bands: ['DAB'] },
  { id: 'juboks', name: 'Radio Juboks', freq: 'DAB+', style: 'Domaci in tuji hiti � nostalgija', group: 'DAB', color: '#d4a63c', stream: 'https://stream.nextmedia.si/proxy/juboks_1?mp=/juboks?uid=jubweb', page: 'https://www.juboks.si/live/juboks', logo: 'juboks', bands: ['DAB'] },
  { id: 'center-x', name: 'Radio Center X', freq: '102.4 FM', style: 'Sodobni pop hiti', group: 'Pop', color: '#19a889', stream: 'https://stream.nextmedia.si/proxy/center2?mp=/stream/1/', page: 'https://siradio.si/center/', logo: 'center', bands: ['FM', 'DAB'], streams: ['https://stream.nextmedia.si/proxy/center2?mp=/stream/1/', 'http://212.30.80.195:8000/stream/1/'] },
  { id: 'radio80', name: 'Radio 1 80-a', freq: 'Spletni radio', style: 'Najvecji hiti iz 80-ih', group: '80-ta', color: '#d47e39', stream: 'https://live.radio1.si/Radio80', page: 'https://radio.svet24.si/Radio80-v-zivo', logo: 'radio80', bands: ['DAB'] },
  { id: 'radio90', name: 'Radio 1 90-a', freq: 'Spletni radio', style: 'Najvecji hiti iz 90-ih', group: '90-ta', color: '#5c77bd', stream: 'https://live.radio1.si/Radio90', page: 'https://radio.svet24.si/Radio90-v-zivo', logo: 'ena', bands: ['DAB'] },
  { id: 'aktual', name: 'Radio Aktual', freq: '100.2 FM', style: 'Slovenski in domači hiti', group: 'Domača', color: '#6e5be8', stream: 'https://live.radio.si/Aktual', page: 'https://siradio.si/aktual/', logo: 'aktual', bands: ['FM', 'DAB'] },
  { id: 'city', name: 'Radio City', freq: '100.8 FM', style: 'Maribor · hiti in humor', group: 'Pop', color: '#e2a533', stream: 'https://stream1.radiocity.si/CityMp3128.mp3', page: 'https://siradio.si/city/', logo: 'city', bands: ['FM', 'DAB'], streams: ['https://stream1.radiocity.si/CityMp3128.mp3', 'http://82.149.22.34:8000/CityMp364mono.mp3'] },
  { id: 'center', name: 'Radio Center', freq: '102.4 FM', style: 'Sodobni pop hiti', group: 'Pop', color: '#19a889', stream: 'https://stream.nextmedia.si/proxy/center2?mp=/stream/1/', page: 'https://siradio.si/center/', logo: 'center', bands: ['FM', 'DAB'], streams: ['https://stream.nextmedia.si/proxy/center2?mp=/stream/1/', 'http://212.30.80.195:8000/stream/1/'] },
  { id: 'capris', name: 'Radio Capris', freq: '91.7 FM', style: 'Primorska · pop hiti', group: 'Pop', color: '#3286e8', stream: 'https://stream.exit.si/live', page: 'https://siradio.si/capris/', logo: 'capris', bands: ['FM', 'DAB'] },
  { id: 'ars', name: 'Radio Ars', freq: '96.5 FM', style: 'Kultura · umetnost · klasika', group: 'Kultura', color: '#8a6cb8', stream: 'https://mp3.rtvslo.si/ars', page: 'https://siradio.si/ars/', logo: 'ars', bands: ['FM', 'DAB'] },
  { id: 'prvi', name: 'Radio Prvi', freq: '91.8 FM', style: 'Informacije · pogovori', group: 'Govorni', color: '#5184c5', stream: 'https://mp3.rtvslo.si/ra1', page: 'https://siradio.si/prvi/', logo: 'prvi', bands: ['FM', 'DAB'] },
  { id: 'si', name: 'Radio Si', freq: '91.9 FM', style: 'Slovenia International', group: 'Pop', color: '#36a8a0', stream: 'https://mp3.rtvslo.si/rsi', page: 'https://siradio.si/si/', logo: 'si', bands: ['FM', 'DAB'] },
  { id: 'ognjisce', name: 'Radio Ognjišče', freq: '104.5 FM', style: 'Duhovna · informativna', group: 'Govorni', color: '#d28b35', stream: 'https://live.radio.si/ognjisce.mp3', page: 'https://siradio.si/ognjisce/', logo: 'ognjisce', bands: ['FM', 'DAB'] },
  { id: 'salomon', name: 'Radio Salomon', freq: '101.6 FM', style: 'Dance · elektronska', group: 'Dance', color: '#ca4eb5', stream: 'https://live.radio.si/Salomon', page: 'https://siradio.si/salomon/', logo: 'salomon', bands: ['FM', 'DAB'] },
  { id: 'veseljak', name: 'Radio Veseljak', freq: '94.9 FM', style: 'Slovenska narodno-zabavna', group: 'Domača', color: '#4fa05c', stream: 'https://live.radio.si/Veseljak', page: 'https://siradio.si/veseljak/', logo: 'veseljak', bands: ['FM', 'DAB'], streams: ['https://live.radio.si/Veseljak', 'http://195.95.158.131/Veseljak'] },
  { id: 'krka', name: 'Radio Krka', freq: '106.6 FM', style: 'Dolenjska · pop hiti', group: 'Pop', color: '#d95e43', stream: 'https://live.radio.si/Krka', page: 'https://siradio.si/krka/', logo: 'krka', bands: ['FM', 'DAB'], streams: ['https://live.radio.si/Krka', 'http://84.52.138.44/Krka'] },
  { id: 'sraka', name: 'Radio Sraka', freq: '94.6 FM', style: 'Dolenjska · lokalni program', group: 'Pop', color: '#bc4c62', stream: 'https://sraka.siradiostream.net/', page: 'https://siradio.si/sraka/', logo: 'sraka', bands: ['FM', 'DAB'] },
  { id: 'ptuj', name: 'Radio Ptuj', freq: '89.8 FM', style: 'Štajerska · domača glasba', group: 'Domača', color: '#e18b36', stream: 'https://live.radio.si/Ptuj', page: 'https://siradio.si/ptuj/', logo: 'ptuj', bands: ['FM', 'DAB'] },
  { id: 'rogla', name: 'Radio Rogla', freq: '89.4 FM', style: 'Štajerska · pop in domača', group: 'Domača', color: '#6ba647', stream: 'https://rogla.siradiostream.net/stream/1/', page: 'https://siradio.si/rogla/', logo: 'rogla', bands: ['FM', 'DAB'], streams: ['https://rogla.siradiostream.net/stream/1/', 'http://193.105.67.24:8010/stream/1/'] },
  { id: 'maxi', name: 'Radio Maxi', freq: '90.0 FM', style: 'Prlekija · pop hiti', group: 'Pop', color: '#5380b9', stream: 'https://live.radio.si/Maxi', page: 'https://siradio.si/maxi/', logo: 'maxi', bands: ['FM', 'DAB'] },
  { id: 'murski-val', name: 'Murski val', freq: '94.6 FM', style: 'Pomurje · lokalni program', group: 'Pop', color: '#398c6a', stream: 'https://stream.murskival.si', page: 'https://siradio.si/murski-val/', logo: 'murski-val', bands: ['FM', 'DAB'] },
  { id: 'koroski', name: 'Koroški radio', freq: '97.2 FM', style: 'Koroška · lokalni program', group: 'Pop', color: '#487bb2', stream: 'https://live.radio.si/Koroski', page: 'https://siradio.si/koroski/', logo: 'koroski', bands: ['FM', 'DAB'] },
  { id: 'ekspres', name: 'Radio Ekspres', freq: '106.4 FM', style: 'Sodobni pop hiti', group: 'Pop', color: '#7758ba', stream: 'https://stream.nextmedia.si/proxy/ekspres1?mp=/stream', page: 'https://siradio.si/ekspres/', logo: 'ekspres', bands: ['FM', 'DAB'], streams: ['https://stream.nextmedia.si/proxy/ekspres1?mp=/stream', 'http://stream2.radioekspres.si:8016/stream/1/'] },
  { id: 'antena', name: 'Radio Antena', freq: '105.2 FM', style: 'Pop hiti · Ljubljana', group: 'Pop', color: '#eb8d30', stream: 'https://live.radio.si/Antena', page: 'https://siradio.si/antena/', logo: 'antena', bands: ['FM', 'DAB'], streams: ['https://live.radio.si/Antena', 'http://live.radioantena.si/Antena'] },
  { id: 'hit', name: 'Radio Hit', freq: '90.2 FM', style: 'Domžale · pop hiti', group: 'Pop', color: '#d84a55', stream: 'https://live.radio.si/Hit', page: 'https://siradio.si/hit/', logo: 'hit', bands: ['FM'] },
  { id: 'aktual-kum', name: 'Radio Aktual Kum', freq: '98.1 FM', style: 'Zasavje · domači hiti', group: 'Domača', color: '#b4558a', stream: 'https://live.radio.si/AktualK', page: 'https://siradio.si/aktual-kum/', logo: 'aktual-kum', bands: ['FM', 'DAB'] },
  { id: 'net-maribor', name: 'Radio Net FM', freq: '100.2 FM', style: 'Maribor · glasba in novice', group: 'Pop', color: '#4177c7', stream: 'https://stream.radionet.si/stream.ogg', page: 'https://siradio.si/net-maribor/', logo: 'net-maribor', bands: ['FM', 'DAB'], streams: ['https://stream.radionet.si/stream.ogg', 'http://reflector.radionet.si:8000/stream.ogg'] },
  { id: 'koper', name: 'Radio Koper', freq: '96.4 FM', style: 'Primorska · kultura in novice', group: 'Govorni', color: '#39a7a2', stream: 'https://mp3.rtvslo.si/rakp', page: 'https://siradio.si/koper/', logo: 'koper', bands: ['FM', 'DAB'] },
  { id: 'stajerski', name: 'Štajerski val', freq: '93.7 FM', style: 'Štajerska · lokalni program', group: 'Pop', color: '#cf7635', stream: 'https://stream.stajerskival.si:8443/live', page: 'https://siradio.si/stajerski/', logo: 'stajerski', bands: ['FM', 'DAB'] },
  { id: 'celje', name: 'Radio Celje', freq: '95.1 FM', style: 'Celje · lokalni program', group: 'Pop', color: '#e24d52', stream: 'https://live.radio.si/Celje', page: 'https://siradio.si/celje/', logo: 'celje', bands: ['FM'] },
  { id: 'zeleni-val', name: 'Radio Zeleni val', freq: '93.1 FM', style: 'Osrednja Slovenija · domača', group: 'Domača', color: '#5d9b4f', stream: 'https://jurepeterka.radioca.st/stream/1/', page: 'https://siradio.si/zeleni-val/', logo: 'zeleni-val', bands: ['FM'] },
  { id: 'radio-dur', name: 'Radio Dur', freq: '103.3 FM', style: 'Medvode · lokalni program', group: 'Pop', color: '#6890b8', stream: 'https://zvok.ragla.si/gr', page: 'https://siradio.si/radio-dur/', logo: 'radio-dur', bands: ['FM'] },
  { id: 'moj', name: 'Moj Radio', freq: '102.6 FM', style: 'Velenje · lokalni program', group: 'Pop', color: '#5b9a65', stream: 'https://stream.mojradio.si:8000/mojradio', page: 'https://siradio.si/moj/', logo: 'moj', bands: ['FM'] },
  { id: 'bob', name: 'Radio 1 Rock', freq: '87.6 FM', style: 'Rock hiti', group: 'Rock', color: '#cf4e3e', stream: 'https://live.radio.si/Radio1Rock', page: 'https://siradio.si/bob/', logo: 'bob', bands: ['FM', 'DAB'] },
  { id: 'robin', name: 'Radio Robin', freq: '100.0 FM', style: 'Goriška · lokalni program', group: 'Pop', color: '#4386ba', stream: 'https://live.radio.si/Robin', page: 'https://siradio.si/robin/', logo: 'robin', bands: ['FM', 'DAB'] },
  { id: 'triglav', name: 'Radio Triglav', freq: '89.8 FM', style: 'Gorenjska · lokalni program', group: 'Pop', color: '#4b80bc', stream: 'https://live.radio.si/Triglav', page: 'https://siradio.si/triglav/', logo: 'triglav', bands: ['FM', 'DAB'] },
  { id: 'maribor', name: 'Radio Maribor', freq: '93.1 FM', style: 'Štajerska · kultura in novice', group: 'Govorni', color: '#b84942', stream: 'https://mp3.rtvslo.si/rmb', page: 'https://siradio.si/maribor/', logo: 'maribor', bands: ['FM', 'DAB'] },
  { id: 'slovenske-gorice', name: 'Radio Slovenske gorice', freq: '96.4 FM', style: 'Lenart · lokalni program', group: 'Pop', color: '#509c5d', stream: 'https://live.radio.si/Toti-Lenart', page: 'https://siradio.si/slovenske-gorice/', logo: 'slovenske-gorice', bands: ['FM', 'DAB'] },
  { id: 'velenje', name: 'Radio Velenje', freq: '107.8 FM', style: 'Šaleška dolina · lokalni program', group: 'Pop', color: '#4995a7', stream: 'https://live.radio.si/Velenje', page: 'https://siradio.si/velenje/', logo: 'velenje', bands: ['FM'], streams: ['https://live.radio.si/Velenje', 'http://live.radio.si:8000/Velenje'] },
  { id: 'prlek', name: 'Radio Prlek', freq: '88.9 FM', style: 'Ormož · lokalni program', group: 'Pop', color: '#b78045', stream: 'http://86.61.68.81:8000/', page: 'https://siradio.si/prlek/', logo: 'prlek', bands: ['FM'] },
  { id: '94', name: 'Radio 94', freq: '97.8 FM', style: 'Notranjska · lokalni program', group: 'Pop', color: '#4599a0', stream: 'http://77.38.12.198:8000/radio94', page: 'https://siradio.si/94/', logo: '94', bands: ['FM', 'DAB'] },
  { id: 'mars', name: 'Radio Marš', freq: '95.9 FM', style: 'Maribor · neodvisni radio', group: 'Kultura', color: '#dc6746', stream: 'https://frekvenca.eu:8443/radiomars.mp3', page: 'https://siradio.si/mars/', logo: 'mars', bands: ['FM'], streams: ['https://frekvenca.eu:8443/radiomars.mp3', 'http://frekvenca.eu:8000/radiomars.mp3'] },
  { id: 'kranj', name: 'Radio Kranj', freq: '97.3 FM', style: 'Gorenjska · lokalni program', group: 'Pop', color: '#5287c7', stream: 'https://live.radio.si/Kranj', page: 'https://siradio.si/kranj/', logo: 'kranj', bands: ['FM', 'DAB'] },
  { id: 'student', name: 'Radio Študent', freq: '89.3 FM', style: 'Kultura · glasba · študentski radio', group: 'Kultura', color: '#b88b3c', stream: 'https://kruljo.radiostudent.si:8001/hiq', page: 'https://siradio.si/student/', logo: 'student', bands: ['FM', 'DAB'] },
  { id: 'sora', name: 'Radio Sora', freq: '91.1 FM', style: 'Škofja Loka · lokalni program', group: 'Pop', color: '#438c70', stream: 'https://stream.radio-sora.si:8001/radio-sora.mp3', page: 'https://siradio.si/sora/', logo: 'sora', bands: ['FM', 'DAB'], streams: ['https://stream.radio-sora.si:8001/radio-sora.mp3', 'http://radio-sora.si:8000/radio-sora.mp3'] },
  { id: 'muravideki-magyar-ljubljana', name: 'Muravidéki Magyar Rádió', freq: '87.6 FM', style: 'Madžarski program · Pomurje', group: 'Govorni', color: '#4789b2', stream: 'https://mp3.rtvslo.si/mmr', page: 'https://siradio.si/muravideki-magyar-ljubljana/', logo: 'muravideki-magyar-ljubljana', bands: ['FM', 'DAB'] },
];
const rid = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

let toastTimer;
function toast(msg) {
  let el = $('#toast');
  if (!el) { el = h('div', { id: 'toast' }); document.body.append(el); }
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

function modal(title, body, actions) {
  return new Promise((resolve) => {
    const close = (v) => { overlay.remove(); resolve(v); };
    const overlay = h('div', { id: 'modal' },
      h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, title), body(close),
        h('div', { class: 'toolbar', style: 'margin:16px 0 0' }, actions(close))));
    document.body.append(overlay);
    overlay.querySelector('input,select')?.focus();
  });
}
const ask = (title, value = '', type = 'text') => {
  const input = h('input', { type, value });
  return modal(title, (close) => {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') close(input.value.trim() || null); });
    return input;
  }, (close) => [btn('V redu', () => close(input.value.trim() || null), 'btn'), btn('Prekliči', () => close(null), 'btn sec')]);
};
const choose = (title, options) => {
  const select = h('select', {}, options.map((o, i) => h('option', { value: i }, o.label)));
  return modal(title, () => select,
    (close) => [btn('V redu', () => close(options[select.value]?.value ?? null), 'btn'), btn('Prekliči', () => close(null), 'btn sec')]);
};
const confirmBox = (title, text) => modal(title, () => h('div', { class: 'note' }, text),
  (close) => [btn('Da', () => close(true), 'btn danger'), btn('Ne', () => close(false), 'btn sec')]);

// ---------- State ----------
const defaultDb = () => ({
  library: [], liked: [], playlists: [], history: [], lyrics: {},
  settings: {
    theme: 'green', fade: 5, eq: { bass: 0, mid: 0, treble: 0 }, volume: 80,
    speed: 1, normalize: false, viz: 'bars', vizColor: 'theme', vizHeight: 52, vizGlow: true, vizSmoothing: 0.72, preset: 'flat', skipIntro: 0, skipOutro: 0,
    ambient: true, ambientCustom: '', ambientPulse: true, snow: false, snowModeConfigured: true, particles: true,
  },
  peerId: '',
});
let db = defaultDb();
let root = { accounts: [], session: '', legacy: null };
let account = null;
let billingStatus = { isPremium: false, status: 'loading', cancelAtPeriodEnd: false, currentPeriodEnd: 0 };
let saveTimer;
function flush() {
  clearTimeout(saveTimer);
  if (account) {
    account.data = db;
    if (account.token) { account.dirty = true; cloudPush(); }
  }
  return window.gmajna.setStore(root);
}

// ---------- Cloud accounts ----------
const DEFAULT_ACCOUNT_API_URL = 'https://rithmifymusic.up.railway.app';
function normalizeAccountApiUrl(value) {
  const url = new URL(String(value || '').trim());
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('Uporabi HTTPS naslov Rythmify strežnika.');
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('URL ne sme vsebovati poti, prijavnih podatkov ali dodatnih parametrov.');
  }
  return url.origin;
}
function currentAccountApiUrl() {
  return DEFAULT_ACCOUNT_API_URL;
}
function accountApiError(r, action = 'Zahteva') {
  if (r.status === 404) return 'API vrača HTTP 404. Preveri URL skupnega Rythmify strežnika.';
  if (r.status === 0) return `Računovodski strežnik ni dosegljiv${r.error ? `: ${r.error}` : '.'}`;
  if (r.status === 401 && action === 'Prijava') return 'Napačno uporabniško ime ali geslo.';
  if (r.json?.error) return r.json.error;
  return `${action} ni uspela (HTTP ${r.status}).`;
}
async function cloud(method, path, body, token) {
  try {
    const base = normalizeAccountApiUrl(currentAccountApiUrl());
    const r = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    const json = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, json };
  } catch (e) { return { ok: false, status: 0, json: {}, error: e.message }; }
}
async function refreshBillingStatus() {
  const activeAccount = account;
  if (!activeAccount?.token) throw new Error('Za preverjanje naročnine se prijavi v račun.');
  const r = await cloud('GET', '/api/billing/status', null, activeAccount.token);
  if (!r.ok) throw new Error(accountApiError(r, 'Preverjanje Premiuma'));
  if (account !== activeAccount) return billingStatus;
  billingStatus = {
    isPremium: !!r.json.isPremium,
    status: String(r.json.status || 'free'),
    cancelAtPeriodEnd: !!r.json.cancelAtPeriodEnd,
    currentPeriodEnd: Number(r.json.currentPeriodEnd || 0),
  };
  return billingStatus;
}
let billingPagePending = false;
async function openBillingPage(endpoint) {
  if (billingPagePending) return;
  if (!account?.token) { toast('Najprej se prijavi v račun.'); return; }
  billingPagePending = true;
  try {
    const r = await cloud('POST', endpoint, {}, account.token);
    if (!r.ok) { toast(accountApiError(r, 'Premium')); return; }
    if (typeof r.json.url !== 'string' || !/^https:\/\/(?:checkout|billing)\.stripe\.com\//.test(r.json.url)) {
      toast('Strežnik ni vrnil veljavne Stripe povezave.');
      return;
    }
    await window.gmajna.openExternal(r.json.url);
  } finally {
    billingPagePending = false;
  }
}
const syncData = () => ({ ...db, library: [] });
let cloudTimer;
function cloudPush() {
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(async () => {
    const a = account;
    if (!a || !a.token) return;
    const r = await cloud('PUT', '/api/account', { data: { ...a.data, library: [] } }, a.token);
    if (r.ok) { a.syncedAt = r.json.updatedAt; a.dirty = false; window.gmajna.setStore(root); }
    else if (r.status === 401) { a.token = ''; window.gmajna.setStore(root); }
  }, 4000);
}
async function cloudPull(acc, wasDirty) {
  if (!acc.token || wasDirty) return;
  const r = await cloud('GET', '/api/account', null, acc.token);
  if (r.status === 401) { acc.token = ''; return; }
  if (!r.ok || account !== acc) return;
  const s = r.json.account;
  if (s.updatedAt && s.updatedAt !== acc.syncedAt) {
    acc.syncedAt = s.updatedAt;
    acc.name = s.name; acc.email = s.email; acc.color = s.color;
    acc.data = { ...mergeData(s.data), library: db.library };
    enterAccount(acc);
  }
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 300);
}
window.addEventListener('beforeunload', flush);

let queue = [];
let qIndex = -1;
let cur = null;
let shuffle = false;
let repeat = 'off';
let view = 'home';
let viewArg = null;
let searchState = { q: '', results: null, error: '' };
let stationQuery = '';
let stationCategory = 'Vse';

// Two audio decks and two YouTube players allow the next track to overlap the current one.
const audioEls = [$('#audio'), h('audio', { preload: 'auto' })];
let audio = audioEls[0];
const radioAudio = new Audio();
radioAudio.preload = 'none';
let radioStartPending = false;
let radioStartGeneration = 0;
let audioCtx;
let deckGain = [];
let eqNodes;
let analyser;
let compressor;
let seeking = false;

// ---------- Accounts ----------
async function hashPw(pw, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2', salt: Uint8Array.from(atob(salt), (c) => c.charCodeAt(0)), iterations: 150000, hash: 'SHA-256',
  }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}
const newSalt = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));

function mergeData(data) {
  const base = defaultDb();
  const d = data || {};
  const savedSettings = d.settings || {};
  const settings = { ...base.settings, ...savedSettings, eq: { ...base.settings.eq, ...(savedSettings.eq || {}) } };
  if (savedSettings.snowModeConfigured !== true) settings.snow = false;
  settings.snowModeConfigured = true;
  delete settings.apiKey;
  return {
    ...base, ...d,
    settings,
  };
}

function enterAccount(acc) {
  const wasDirty = !!acc.dirty;
  const authEl = $('#auth');
  authEl.hidden = true;
  authEl.replaceChildren();
  account = acc;
  billingStatus = { isPremium: false, status: 'loading', cancelAtPeriodEnd: false, currentPeriodEnd: 0 };
  db = mergeData(acc.data);
  delete db.settings.server;
  if (!db.peerId) db.peerId = rid();
  root.session = acc.remember ? acc.id : '';
  pendingJamInvites.clear();
  renderJamInvitePopups();
  $('#volume').value = db.settings.volume;
  for (const el of audioEls) { el.volume = db.settings.volume / 100; el.playbackRate = db.settings.speed; }
  radioAudio.volume = db.settings.volume / 100;
  applyTheme();
  startParticles();
  updateAvatar();
  view = 'home';
  viewArg = null;
  renderAll();
  toggleSide(true);
  flush();
  void pollJamInvites();
  if (pendingJamInvite) setTimeout(() => { void openPendingJamInvite(); }, 0);
  refreshBillingStatus().then(() => {
    if (account === acc && view === 'profile') render();
  }).catch((e) => {
    console.error('Premium status:', e.message);
    if (account === acc) {
      billingStatus = { isPremium: false, status: 'unavailable', cancelAtPeriodEnd: false, currentPeriodEnd: 0 };
      if (view === 'profile') render();
    }
  });
}

async function logout() {
  await flush();
  jamLeave(true);
  stopEngines();
  cur = null; queue = []; qIndex = -1;
  account = null;
  pendingJamInvites.clear();
  renderJamInvitePopups();
  billingStatus = { isPremium: false, status: 'loading', cancelAtPeriodEnd: false, currentPeriodEnd: 0 };
  root.session = '';
  db = defaultDb();
  updateNow();
  await window.gmajna.setStore(root);
  showAuth();
}

function showAuth(mode = root.accounts.length ? 'login' : 'register') {
  const auth = $('#auth');
  auth.hidden = false;
  let tab = mode;
  const drawReset = (prefill = '') => {
    const key = h('input', { type: 'text', placeholder: 'E-pošta ali uporabniško ime', value: prefill, maxlength: '120' });
    const code = h('input', { type: 'text', placeholder: 'Koda iz e-pošte (6 številk)', maxlength: '6', inputmode: 'numeric' });
    const pw = h('input', { type: 'password', placeholder: 'Novo geslo' });
    const pw2 = h('input', { type: 'password', placeholder: 'Ponovi novo geslo' });
    const err = h('div', { class: 'err' });
    const sendBtn = h('button', { class: 'btn sec', onclick: async () => {
      if (!key.value.trim()) { err.textContent = 'Vnesi e-pošto ali ime.'; return; }
      err.textContent = 'Pošiljam …';
      const r = await cloud('POST', '/api/reset/request', { key: key.value.trim().toLowerCase() });
      err.textContent = r.ok ? 'Če profil obstaja, je koda poslana na e-pošto.' : accountApiError(r, 'Pošiljanje kode');
    } }, 'Pošlji kodo');
    const confirmReset = async () => {
      if (!/^\d{6}$/.test(code.value.trim())) { err.textContent = 'Vnesi 6-mestno kodo.'; return; }
      if (pw.value.length < 6) { err.textContent = 'Geslo naj ima vsaj 6 znakov.'; return; }
      if (pw.value !== pw2.value) { err.textContent = 'Gesli se ne ujemata.'; return; }
      err.textContent = 'Spreminjam …';
      const salt = newSalt();
      const r = await cloud('POST', '/api/reset/confirm', { key: key.value.trim().toLowerCase(), code: code.value.trim(), salt, hash: await hashPw(pw.value, salt) });
      if (!r.ok) { err.textContent = accountApiError(r, 'Ponastavitev gesla'); return; }
      const k = key.value.trim().toLowerCase();
      root.accounts = root.accounts.filter((a) => (a.email || '') !== k && a.name.toLowerCase() !== k);
      await window.gmajna.setStore(root);
      toast('Geslo je spremenjeno. Prijavi se z novim.');
      tab = 'login';
      draw();
    };
    auth.replaceChildren(h('div', { class: 'box' },
      h('span', { class: 'brand-mark', role: 'img', 'aria-label': 'Rythmify' }),
      h('div', { class: 'note', style: 'margin:0 auto' }, 'Ponastavitev gesla'),
      key, sendBtn, code, pw, pw2, err,
      h('button', { class: 'btn', onclick: confirmReset }, 'Nastavi novo geslo'),
      h('button', { class: 'btn sec', onclick: () => { tab = 'login'; draw(); } }, 'Nazaj na prijavo')));
    key.focus();
  };
  const draw = () => {
    const name = h('input', { type: 'text', placeholder: tab === 'login' ? 'E-pošta ali uporabniško ime' : 'Uporabniško ime', maxlength: '60' });
    const email = h('input', { type: 'text', placeholder: 'E-pošta (neobvezno)', maxlength: '120', autocomplete: 'email' });
    const pw = h('input', { type: 'password', placeholder: 'Geslo' });
    const pw2 = h('input', { type: 'password', placeholder: 'Ponovi geslo' });
    const remember = h('input', { type: 'checkbox', checked: 'checked' });
    const err = h('div', { class: 'err', role: 'alert', 'aria-live': 'polite' });
    let submitBusy = false;
    let submitBtn = null;
    const submit = async () => {
      if (submitBusy) return;
      submitBusy = true;
      err.textContent = '';
      const modeNow = tab;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = modeNow === 'login' ? 'Prijavljam …' : 'Ustvarjam profil …';
      }
      try {
        const uname = name.value.trim();
        if (!uname || !pw.value) { err.textContent = 'Vnesi uporabniško ime in geslo.'; return; }
        if (modeNow === 'register') {
          const mail = email.value.trim().toLowerCase();
          if (uname.length < 2 || uname.length > 24) { err.textContent = 'Ime naj ima 2 do 24 znakov.'; return; }
          if (mail && !EMAIL_RE.test(mail)) { err.textContent = 'E-poštni naslov ni veljaven (lahko ga pustiš praznega).'; return; }
          if (mail && root.accounts.some((a) => (a.email || '') === mail)) { err.textContent = 'Ta e-pošta je že registrirana.'; return; }
          if (pw.value.length < 6) { err.textContent = 'Geslo naj ima vsaj 6 znakov.'; return; }
          if (pw.value !== pw2.value) { err.textContent = 'Gesli se ne ujemata.'; return; }
          if (root.accounts.some((a) => a.name.toLowerCase() === uname.toLowerCase())) { err.textContent = 'To ime je že zasedeno.'; return; }
          const salt = newSalt();
          const acc = {
            id: rid(), name: uname, email: mail, salt, hash: await hashPw(pw.value, salt),
            color: COLORS[root.accounts.length % COLORS.length], remember: remember.checked,
            data: root.legacy || defaultDb(),
          };
          const r = await cloud('POST', '/api/register', {
            id: acc.id, name: acc.name, email: acc.email, salt: acc.salt, hash: acc.hash, color: acc.color,
            data: { ...acc.data, library: [] },
          });
          if (!r.ok) { err.textContent = accountApiError(r, 'Registracija'); return; }
          if (typeof r.json.token !== 'string' || !r.json.token) {
            err.textContent = 'Strežnik ni vrnil prijavnega žetona. Preveri konfiguracijo API-ja.';
            return;
          }
          acc.token = r.json.token;
          root.legacy = null;
          root.accounts.push(acc);
          enterAccount(acc);
        } else {
          const key = uname.toLowerCase();
          let acc = root.accounts.find((a) => (a.email || '') === key || a.name.toLowerCase() === key);
          const localLoginValid = !!(acc && acc.salt && acc.hash && (await hashPw(pw.value, acc.salt)) === acc.hash);
          if (!navigator.onLine) {
            if (!localLoginValid) {
              err.textContent = 'Brez povezave ni mogoče preveriti tega računa v strežniku.';
              return;
            }
            toast('Brez povezave: prijavljen je lokalni profil; sinhronizacija ni na voljo.');
          } else {
            const s = await cloud('GET', '/api/salt?key=' + encodeURIComponent(key));
            if (!s.ok) {
              if (localLoginValid && s.status === 0) {
                toast('Strežnik ni dosegljiv: prijavljen je lokalni profil; sinhronizacija ni na voljo.');
              } else {
                err.textContent = accountApiError(s, 'Prijava');
                return;
              }
            } else {
              if (typeof s.json.salt !== 'string' || !s.json.salt) {
                err.textContent = 'Strežnik je vrnil neveljavne prijavne podatke.';
                return;
              }
              const hash = await hashPw(pw.value, s.json.salt);
              const r = await cloud('POST', '/api/login', { key, hash });
              if (!r.ok) { err.textContent = accountApiError(r, 'Prijava'); return; }
              const c = r.json.account;
              if (!c || typeof r.json.token !== 'string' || !r.json.token) {
                err.textContent = 'Strežnik ni vrnil veljavnega računa. Preveri njegovo različico.';
                return;
              }
              const local = root.accounts.find((a) => a.id === c.id);
              acc = local || { id: c.id, data: null };
              Object.assign(acc, { name: c.name, email: c.email, color: c.color, salt: c.salt, hash: c.hash, token: r.json.token, syncedAt: c.updatedAt, dirty: false });
              acc.data = { ...mergeData(c.data), library: local?.data?.library || [] };
              if (!local) root.accounts.push(acc);
            }
          }
          acc.remember = remember.checked;
          enterAccount(acc);
        }
      } catch (e) {
        console.error('Napaka pri prijavi ali registraciji:', e);
        err.textContent = `Prijava ni uspela: ${e.message || 'nepričakovana napaka.'}`;
      } finally {
        submitBusy = false;
        if (submitBtn?.isConnected) {
          submitBtn.disabled = false;
          submitBtn.textContent = modeNow === 'login' ? 'Prijava' : 'Ustvari profil';
        }
      }
    };
    for (const i of [name, email, pw, pw2]) i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    const loginTab = h('button', { class: tab === 'login' ? 'on' : '', onclick: () => {
      if (!submitBusy) { tab = 'login'; draw(); }
    } }, 'Prijava');
    const registerTab = h('button', { class: tab === 'register' ? 'on' : '', onclick: () => {
      if (!submitBusy) { tab = 'register'; draw(); }
    } }, 'Nov profil');
    submitBtn = h('button', { class: 'btn', onclick: submit }, tab === 'login' ? 'Prijava' : 'Ustvari profil');
    auth.replaceChildren(h('div', { class: 'box' },
      h('span', { class: 'brand-mark', role: 'img', 'aria-label': 'Rythmify' }),
      h('div', { class: 'note', style: 'margin:0 auto' }, 'Zasebna glasba. Prijavi se ali ustvari profil.'),
      h('div', { class: 'tabs' },
        loginTab, registerTab),
      name, tab === 'register' ? email : null, pw, tab === 'register' ? pw2 : null,
      h('label', { class: 'rem' }, remember, 'Ostani prijavljen'),
      tab === 'login' ? h('a', { href: '#', style: 'font-size:13px;opacity:.8;text-align:center', onclick: (e) => { e.preventDefault(); drawReset(name.value.trim()); } }, 'Pozabljeno geslo?') : null,
      err,
      submitBtn,
      h('div', { class: 'note', style: 'font-size:12px;margin:16px auto 0' }, 'Profil se shrani v oblak – prijaviš se lahko na vsakem računalniku.')));
    name.focus();
  };
  draw();
}

function avatarBg(prof) {
  const p = prof.avatarPos || { x: 50, y: 50, zoom: 1, ratio: 1 };
  const z = Math.round(p.zoom * 100);
  const size = (p.ratio || 1) >= 1 ? `auto ${z}%` : `${z}% auto`;
  return `url(${prof.avatar}) ${p.x}% ${p.y}%/${size} no-repeat`;
}
function adjustAvatar(prof, done) {
  const pos = { x: 50, y: 50, zoom: 1, ratio: 1, ...(prof.avatarPos || {}) };
  const prev = h('div', { style: 'width:220px;height:220px;border-radius:50%;margin:0 auto 14px;cursor:grab;touch-action:none;background-color:#222' });
  const apply = () => {
    prev.style.background = avatarBg({ avatar: prof.avatar, avatarPos: pos });
  };
  const cover = () => (pos.ratio >= 1 ? { w: 220 * pos.ratio, h: 220 } : { w: 220, h: 220 / pos.ratio });
  let drag = null;
  prev.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; prev.setPointerCapture(e.pointerId); prev.style.cursor = 'grabbing'; });
  prev.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const c = cover();
    const ow = Math.max(1, c.w * pos.zoom - 220), oh = Math.max(1, c.h * pos.zoom - 220);
    pos.x = Math.min(100, Math.max(0, drag.px - ((e.clientX - drag.x) / ow) * 100));
    pos.y = Math.min(100, Math.max(0, drag.py - ((e.clientY - drag.y) / oh) * 100));
    apply();
  });
  prev.addEventListener('pointerup', () => { drag = null; prev.style.cursor = 'grab'; });
  const zoom = h('input', { type: 'range', min: '100', max: '300', value: String(Math.round(pos.zoom * 100)), style: 'width:100%' });
  zoom.addEventListener('input', () => { pos.zoom = Number(zoom.value) / 100; apply(); });
  const close = () => overlay.remove();
  const overlay = h('div', { style: 'position:fixed;inset:0;background:#000a;z-index:100;display:grid;place-items:center' },
    h('div', { style: 'background:#18181b;padding:22px;border-radius:14px;width:300px' },
      h('div', { class: 'note', style: 'text-align:center;margin-bottom:10px' }, 'Povleci sliko in nastavi povečavo'),
      prev, zoom,
      h('div', { class: 'toolbar', style: 'justify-content:center;margin-top:14px' },
        btn('Shrani', () => { prof.avatarPos = pos; close(); done(); }, 'btn'),
        btn('Prekliči', close, 'btn sec'))));
  apply();
  document.body.append(overlay);
}

function updateAvatar() {
  const b = $('#avatar-btn');
  const pic = account && db && db.profile && db.profile.avatar;
  b.textContent = pic ? '' : account ? account.name[0].toUpperCase() : '';
  b.style.background = pic ? avatarBg(db.profile) : account ? account.color : '#444';
  $('#profile-name').textContent = account ? account.name : '';
}

// ---------- Playback engines ----------
function ensureAudioGraph() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  const bass = new BiquadFilterNode(audioCtx, { type: 'lowshelf', frequency: 200 });
  const mid = new BiquadFilterNode(audioCtx, { type: 'peaking', frequency: 1000, Q: 1 });
  const treble = new BiquadFilterNode(audioCtx, { type: 'highshelf', frequency: 4000 });
  compressor = audioCtx.createDynamicsCompressor();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.82;
  deckGain = audioEls.map((el) => {
    el.crossOrigin = 'anonymous';
    const gain = audioCtx.createGain();
    audioCtx.createMediaElementSource(el).connect(gain).connect(bass);
    return gain;
  });
  bass.connect(mid).connect(treble).connect(compressor).connect(analyser).connect(audioCtx.destination);
  eqNodes = { bass, mid, treble };
  applyEq();
  applyNormalize();
  for (const el of audioEls) el.playbackRate = db.settings.speed;
}
function applyNormalize() {
  if (!compressor) return;
  const on = db.settings.normalize;
  compressor.threshold.value = on ? -28 : 0;
  compressor.ratio.value = on ? 6 : 1;
  compressor.knee.value = on ? 24 : 0;
}
function applySpeed() {
  for (const el of audioEls) { el.defaultPlaybackRate = db.settings.speed; el.playbackRate = db.settings.speed; }
  yt?.setPlaybackRate?.(db.settings.speed);
}
function applyEq(hint) {
  if (hint && ytActive()) toast('Izenačevalnik ne deluje pri YouTube skladbah – dodaj skladbo v Offline knjižnico.');
  if (!eqNodes) return;
  for (const k of ['bass', 'mid', 'treble']) eqNodes[k].gain.value = Number(db.settings.eq[k]) || 0;
}

let yt = null;
let ytPlayers = [];
let ytReady = null;
const ytBlocked = new Set();
const ytActive = () => !!cur && cur.type === 'yt';
const activeAudio = () => cur?.type === 'radio' ? radioAudio : audio;
const isPlaying = () => (ytActive() ? yt?.__st === 1 || yt?.__st === 3 : !!cur && !activeAudio().paused && !activeAudio().ended);
const getPos = () => (!cur || cur.type === 'radio' ? 0 : ytActive() ? (yt?.getCurrentTime?.() || 0) : audio.currentTime || 0);
const getDur = () => {
  if (!cur || cur.type === 'radio') return 0;
  if (ytActive()) return yt?.getDuration?.() || 0;
  return isFinite(audio.duration) ? audio.duration : cur.duration || 0;
};

function loadYT() {
  if (ytReady) return ytReady;
  ytReady = new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => {
      let ready = 0;
      const make = (id, z) => {
        const slot = $('#' + id).parentElement;
        slot.style.zIndex = z;
        const p = new YT.Player(id, {
          width: '100%', height: '100%',
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, fs: 0, iv_load_policy: 3, modestbranding: 1 },
          events: {
            onReady: () => { p.setVolume(db.settings.volume); if (++ready === 2) resolve(true); },
            onStateChange: (e) => {
              p.__st = e.data;
              if (p !== yt) return;
              if (e.data === 0) onEnded();
              updatePlayBtn();
              jamBroadcast();
            },
            onError: () => {
              if (p !== yt) return;
              if (cur) ytBlocked.add(cur.id);
              toast('Lastnik videa ne dovoli vdelave – preskakujem.');
              if (!jamGuest()) setTimeout(() => next(false), 600);
            },
          },
        });
        p.__slot = slot;
        p.__st = -1;
        return p;
      };
      ytPlayers = [make('yt', 2), make('yt2', 1)];
      yt = ytPlayers[0];
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { ytReady = null; resolve(false); };
    document.head.append(s);
  });
  return ytReady;
}

const ytVideoCache = new Map();
const isTopicArtist = (artist) => /\btopic\b/i.test(String(artist || ''));
async function findMusicVideo(track, sourceArtist = track.artist) {
  const artist = String(sourceArtist || '').replace(/\s*-\s*Topic\b.*$/i, '').trim();
  const title = String(track.title || '').trim();
  if (!artist || !title) return null;
  const key = `${artist} ${title}`.toLowerCase();
  if (!ytVideoCache.has(key)) {
    ytVideoCache.set(key, window.gmajna.ytVideoSearch(`${artist} ${title} official music video`));
  }
  const videos = await ytVideoCache.get(key);
  const normalize = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const titleTokens = normalize(title).match(/[a-z0-9]+/g) || [];
  const artistTokens = normalize(artist).match(/[a-z0-9]+/g) || [];
  const excluded = /\b(lyrics?|besedilo|karaoke|cover|visualizer|provided to youtube|official audio|audio only)\b/i;
  const matches = videos.map((video) => {
    const videoTitle = normalize(video.title);
    const videoArtist = normalize(video.artist);
    const searchable = `${videoTitle} ${videoArtist}`;
    if (excluded.test(searchable) || isTopicArtist(video.artist)) return null;
    const titleHits = titleTokens.filter((token) => videoTitle.includes(token)).length;
    const artistHits = artistTokens.filter((token) => searchable.includes(token)).length;
    if (!titleTokens.length || titleHits < Math.ceil(titleTokens.length * 0.7) || !artistHits) return null;
    const official = /\bofficial\b/i.test(videoTitle) ? 2 : 0;
    const titleExact = videoTitle.includes(normalize(title)) ? 3 : 0;
    return { video, score: titleHits / titleTokens.length * 10 + artistHits / artistTokens.length + official + titleExact };
  }).filter(Boolean);
  matches.sort((a, b) => b.score - a.score);
  return matches[0]?.video || null;
}

// The outgoing track keeps playing (and fading out) here while the next one fades in.
let ghost = null;
function killGhost() {
  if (!ghost) return;
  if (ghost.type === 'yt') ghost.p.pauseVideo?.(); else ghost.el.pause();
  ghost = null;
  if (!ytActive()) $('#yt-wrap').classList.remove('show');
}
function stopEngines() {
  ghost = null;
  radioStartGeneration += 1;
  radioStartPending = false;
  radioAudio.pause();
  for (const el of audioEls) el.pause();
  for (const p of ytPlayers) p.pauseVideo?.();
}
async function playRadioStreams(track) {
  const streams = [...new Set([track.stream, ...(track.station?.streams || [])]
    .filter((url) => typeof url === 'string' && /^https?:\/\//.test(url)))];
  const generation = ++radioStartGeneration;
  let lastError;
  radioStartPending = true;
  try {
    for (const stream of streams) {
      if (generation !== radioStartGeneration) return false;
      radioAudio.pause();
      radioAudio.removeAttribute('src');
      radioAudio.load();
      radioAudio.src = stream;
      let timeoutId;
      try {
        await Promise.race([
          radioAudio.play(),
          new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new Error('Radio stream timed out')), 10000); }),
        ]);
        if (generation !== radioStartGeneration) return false;
        track.stream = stream;
        return true;
      } catch (error) {
        if (generation !== radioStartGeneration) return false;
        lastError = error;
        console.warn(`Radio stream attempt failed for "${track.title}":`, stream, error);
      } finally {
        clearTimeout(timeoutId);
      }
    }
    console.error(`Radio station "${track.title}" could not start:`, lastError);
    toast(`${track.title}: postaje ni mogoče predvajati. Preveri povezavo ali poskusi drugo postajo.`);
    return false;
  } finally {
    if (generation === radioStartGeneration) radioStartPending = false;
  }
}
const engineSeek = (sec) => { if (ytActive()) yt?.seekTo?.(sec, true); else if (cur?.type !== 'radio') audio.currentTime = sec; };
const enginePlay = () => {
  if (ytActive()) yt?.playVideo?.();
  else if (cur?.type === 'radio') playRadioStreams(cur);
  else { audioCtx?.resume(); audio.play().catch(() => {}); }
};
const enginePause = () => {
  if (cur?.type === 'radio') { radioStartGeneration += 1; radioStartPending = false; }
  killGhost();
  if (ytActive()) yt?.pauseVideo?.(); else activeAudio().pause();
};

let curStart = 0;
let loopA = null;
let loopB = null;
let outroDone = '';

async function startTrack(track, start = 0, cross = false) {
  const f = Number(db.settings.fade) || 0;
  if (!start && !jam.room && track.type !== 'radio') start = Number(db.settings.skipIntro) || 0;
  curStart = start;
  if (!cross) killGhost();
  if (track.type === 'radio') {
    if (!navigator.onLine) { toast('Za poslušanje radia v živo potrebuješ internetno povezavo.'); return false; }
    stopEngines();
    $('#yt-wrap').classList.remove('show');
    radioAudio.volume = db.settings.volume / 100;
    return playRadioStreams(track);
  }
  if (track.type === 'local') {
    if (!db.library.some((t) => t.id === track.id)) { toast('Skladba ni več v knjižnici.'); return false; }
    const outgoingLocal = cross && cur?.type === 'local';
    const el = outgoingLocal ? audioEls[1 - audioEls.indexOf(audio)] : audio;
    if (!cross) {
      stopEngines();
      $('#yt-wrap').classList.remove('show');
    }
    el.crossOrigin = 'anonymous';
    el.src = `/media/${encodeURIComponent(track.file)}`;
    ensureAudioGraph();
    el.playbackRate = db.settings.speed;
    el.volume = db.settings.volume / 100;
    deckGain[audioEls.indexOf(el)].gain.value = f > 0 ? 0 : 1;
    try { await audioCtx.resume(); await el.play(); } catch { return false; }
    if (start) el.currentTime = start;
    audio = el;
    return true;
  }
  if (!navigator.onLine) { toast('Brez povezave lahko predvajaš samo offline skladbe.'); return false; }
  if (!track.videoId && track.q) {
    try {
      const [m] = await ytSearch(track.q, 1, true);
      if (m) { track.videoId = m.videoId; track.sourceArtist = m.artist; save(); }
    } catch (e) { toast(e.message); return false; }
  }
  const sourceArtist = track.sourceArtist || track.artist;
  try {
    const video = await findMusicVideo(track, sourceArtist);
    if (video) {
      track.videoId = video.videoId;
      track.id = `yt:${video.videoId}`;
      if (isTopicArtist(track.artist)) track.artist = video.artist || track.artist.replace(/\s*-\s*Topic\b.*$/i, '');
      track.cover = video.cover || track.cover;
      delete track.sourceArtist;
      save();
    }
  } catch (e) {
    console.warn(`Music video lookup failed for "${track.title}":`, e);
  }
  if (!/^[\w-]{11}$/.test(track.videoId || '')) { toast('Neveljaven video.'); return false; }
  if (!(await loadYT())) { toast('YouTube predvajalnika ni bilo mogoče naložiti.'); return false; }
  const outgoingYt = cross && cur?.type === 'yt';
  const target = outgoingYt ? ytPlayers[1 - ytPlayers.indexOf(yt)] : yt;
  if (!cross) { radioAudio.pause(); for (const el of audioEls) el.pause(); }
  $('#yt-wrap').classList.add('show');
  target.__st = 3;
  target.setVolume(f > 0 ? 0 : db.settings.volume);
  target.loadVideoById({ videoId: track.videoId, startSeconds: start || 0 });
  target.playVideo();
  target.setPlaybackRate?.(db.settings.speed);
  for (const p of ytPlayers) p.__slot.style.zIndex = p === target ? 2 : 1;
  yt = target;
  return true;
}
for (const el of audioEls) {
  el.addEventListener('error', () => { if (el === audio && cur && cur.type === 'local' && el.src) toast('Skladbe ni mogoče predvajati.'); });
}
radioAudio.addEventListener('error', () => {
  if (cur?.type === 'radio' && !radioStartPending) toast(`${cur.title}: radijske postaje trenutno ni mogoče doseči.`);
});
radioAudio.addEventListener('play', () => {
  updatePlayBtn();
  if (view === 'stations') render();
});
radioAudio.addEventListener('pause', () => {
  updatePlayBtn();
  if (view === 'stations') render();
});

async function playTrack(track, opts = {}) {
  const out = opts.cross && cur ? (cur.type === 'yt' ? { type: 'yt', p: yt } : { type: 'local', el: audio }) : null;
  const ok = await startTrack(track, opts.start || 0, !!opts.cross);
  if (!ok) return false;
  if (out) ghost = out;
  xfadeFailed = '';
  loopA = loopB = null;
  outroDone = '';
  cur = track;
  if (opts.queue) { queue = opts.queue; qIndex = queue.findIndex((t) => t.id === track.id); queueOrig = null; if (shuffle) shuffleRest(); }
  histAcc = 0;
  histDone = track.type === 'radio';
  save();
  updateNow();
  if (['home', 'history', 'queue'].includes(view)) render();
  jamBroadcast(true);
  return true;
}

// Shuffle rewrites the real queue order, so "Naslednje" always shows what will actually play.
let queueOrig = null;
function shuffleRest() {
  if (qIndex < 0) return;
  queueOrig = queueOrig || [...queue];
  const rest = shuffled(queue.slice(qIndex + 1));
  queue = [...queue.slice(0, qIndex + 1), ...rest];
}
function setShuffle(on) { setShuffleMode(on ? 1 : 0); }
// 0 = off, 1 = shuffle, 2 = smart shuffle (shuffle + similar tracks, only for user-made playlists)
function setShuffleMode(mode) {
  const on = mode > 0;
  const wasOn = shuffle;
  shuffle = on;
  smart = mode === 2;
  if (smart) radioFailedFor = '';
  const b = $('#btn-shuffle');
  b.classList.toggle('on', on);
  b.innerHTML = smart ? ICON.smartShuffle : ICON.shuffle;
  b.title = smart ? 'Pametno naključno (dodaja podobne skladbe)' : on ? 'Naključno' : 'Naključno';
  if (npRefs.shuffle) npRefs.shuffle.innerHTML = b.innerHTML;
  if (on && !wasOn) shuffleRest();
  else if (!on && queueOrig) {
    // back to the original order; tracks added by smart shuffle are dropped
    queue = [...queueOrig];
    queueOrig = null;
    qIndex = cur ? queue.findIndex((t) => t.id === cur.id) : -1;
  }
  if (view === 'queue') render();
  if (!$('#side-panel').hidden) renderSidePanel();
}
function cycleShuffle() {
  if (!shuffle) return setShuffleMode(1);
  if (!smart && plQueue) { toast('Pametno naključno: dodaja podobne skladbe.'); return setShuffleMode(2); }
  if (!smart && !plQueue) toast('Pametno naključno deluje samo v seznamih, ki si jih ustvaril.');
  return setShuffleMode(0);
}

function playFrom(list, track) {
  // smart shuffle is only offered for queues started from a user-made playlist
  plQueue = view === 'playlists' && db.playlists.some((p) => p.id === viewArg);
  if (!plQueue && smart) setShuffleMode(shuffle ? 1 : 0);
  if (jamGuest()) return jamCommand('play', { track: track.type === 'yt' ? track : null });
  playTrack(track, { queue: [...list] });
}

function togglePlay() {
  if (jamGuest()) return jamCommand('toggle');
  if (!cur) { if (queue.length) playTrack(queue[Math.max(qIndex, 0)]); return; }
  if (isPlaying()) enginePause(); else enginePlay();
  updatePlayBtn();
  jamBroadcast(true);
}

function pickNext(auto) {
  if (!queue.length) return null;
  if (repeat === 'one' && auto && !ytBlocked.has(queue[qIndex].id)) return queue[qIndex];
  const ok = (t) => !ytBlocked.has(t.id) && (navigator.onLine || t.type === 'local');
  const playable = queue.map((t, i) => i).filter((i) => (i !== qIndex || queue.length === 1) && ok(queue[i]));
  if (!playable.length) return null;
  for (let step = 1; step <= queue.length; step++) {
    const i = qIndex + step;
    if (i >= queue.length && repeat === 'off' && auto) return null;
    const t = queue[i % queue.length];
    if (ok(t)) return t;
  }
  return null;
}

// A track enters history only after 5 s of actual playback.
let histAcc = 0;
let histDone = true;
setInterval(() => {
  if (histDone || !cur || !isPlaying()) return;
  histAcc += 0.25;
  if (histAcc < 5) return;
  histDone = true;
  db.history = [cur, ...db.history.filter((t) => t.id !== cur.id)].slice(0, 100);
  save();
  if (['home', 'history'].includes(view)) render();
}, 250);

// Endless radio: extend a playlist with tracks that stay close to the current artist and style.
let radioBusy = false;
let plQueue = false;
let smart = false;
const radioOn = () => smart && plQueue;
let radioFailedFor = '';
const RADIO_FOLK_ARTISTS = [
  'ansambel saša avsenika', 'avsenik', 'modrijani', 'poskočni muzikanti',
  'vražji muzikanti', 'veseli svatje', 'ansambel stil', 'ansambel roka žlindre',
  'gadi', 'fehtarji', 'navihanke', 'mladi korenjaki', 'ansambel banovšek',
  'ansambel unikat', 'ansambel župan', 'alpski kvintet', 'lojze slak',
];
const RADIO_POP_ARTISTS = [
  'miran rudan', 'pop design', 'maraaya', 'calypso', 'jan plestenjak',
  'nina pušlar', 'nuša derenda', 'manca špik', 'tanja žagar', 'domen kumer',
  'alya', 'kingston', 'flirrt', 'tabu', 'čuki',
];
const RADIO_STYLE_PROFILES = [
  {
    query: 'slovenska narodnozabavna glasba',
    artists: RADIO_FOLK_ARTISTS,
    matches(track) {
      const text = radioText(`${track.artist || ''} ${track.title || ''}`);
      return this.artists.some((artist) => text.includes(radioText(artist)))
        || /\b(ansambel|kvintet|narodnozabavna|narodna glasba|polka|harmonika|frajtonarica)\b/.test(text);
    },
    matchesResult(track) {
      const artist = radioText(track.artist || '');
      return this.artists.some((name) => artist.includes(radioText(name)))
        || /\b(ansambel|kvintet|polka|harmonika|frajtonarica)\b/.test(artist);
    },
  },
  {
    query: 'slovenski pop',
    artists: RADIO_POP_ARTISTS,
    matches(track) {
      const text = radioText(`${track.artist || ''} ${track.title || ''}`);
      return this.artists.some((artist) => text.includes(radioText(artist)));
    },
    matchesResult(track) {
      const artist = radioText(track.artist || '');
      return this.artists.some((name) => artist.includes(radioText(name)));
    },
  },
];
function radioText(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function radioStyleProfile(track) {
  return RADIO_STYLE_PROFILES.find((profile) => profile.matches(track));
}
async function radioFill() {
  if (radioBusy || !cur || !navigator.onLine) return [];
  radioBusy = true;
  const seedId = cur.id;
  try {
    const artist = String(cur.artist || '').trim();
    if (!artist) {
      radioFailedFor = seedId;
      toast('Pametni radio za to skladbo ne najde izvajalca.');
      return [];
    }
    const profile = radioStyleProfile(cur);
    let results;
    if (profile) {
      const currentArtist = radioText(artist);
      const relatedArtists = profile.artists.filter((name) => !currentArtist.includes(radioText(name)));
      const seeds = relatedArtists.length ? shuffled(relatedArtists).slice(0, 3) : [artist];
      results = (await Promise.all(seeds.map((seed) => ytSearch(`${seed} ${profile.query}`, 15, true)))).flat();
    } else {
      const queries = [
        `similar artists to ${artist}`,
        `similar songs to ${artist} ${cur.title || ''}`.trim(),
      ];
      results = (await Promise.all(queries.map((query) => ytSearch(query, 25, true)))).flat();
    }
    const have = new Set([...queue, ...db.history.slice(0, 30)].map((t) => t.id));
    const selectFresh = (tracks) => shuffled([...new Map(tracks.map((track) => [track.id, track])).values()])
      .filter((track) => !have.has(track.id) && !ytBlocked.has(track.id))
      .filter((track) => !profile || profile.matchesResult(track))
      .slice(0, 12);
    let fresh = selectFresh(results);
    if (!fresh.length) {
      const query = profile ? `${artist} ${profile.query}` : artist;
      fresh = selectFresh(await ytSearch(query, 25, true));
    }
    if (!fresh.length) {
      radioFailedFor = seedId;
      toast('Pametni radio ni našel podobnih skladb v istem slogu.');
      return [];
    }
    queue.push(...fresh);
    if (queue.length > 300) { const drop = queue.length - 300; queue = queue.slice(drop); qIndex = Math.max(0, qIndex - drop); }
    if (view === 'queue') render();
    if (!$('#side-panel').hidden) renderSidePanel();
    if (npOpen) npRenderList();
    return fresh;
  } catch (e) {
    radioFailedFor = seedId;
    toast(`Pametni radio: ${e.message || 'iskanje ni uspelo.'}`);
    return [];
  } finally { radioBusy = false; }
}

function next(auto) {
  if (jamGuest()) return jamCommand('next');
  const t = pickNext(auto === true);
  if (!t) {
    if (auto === true) {
      if (radioOn() && cur) {
        radioFill().then((added) => {
          if (added.length && !isPlaying()) { qIndex = queue.indexOf(added[0]); playTrack(added[0]); } else if (!added.length) { stopEngines(); updatePlayBtn(); }
        });
        return;
      }
      stopEngines(); updatePlayBtn();
    }
    return;
  }
  qIndex = queue.indexOf(t);
  playTrack(t);
}

function prev() {
  if (jamGuest()) return jamCommand('prev');
  if (getPos() > 3 || !queue.length) { seekTo(0); return; }
  qIndex = (qIndex - 1 + queue.length) % queue.length;
  playTrack(queue[qIndex]);
}

function onEnded() { if (!jamGuest()) next(true); }
for (const el of audioEls) {
  el.addEventListener('ended', () => { if (el === audio) onEnded(); });
  el.addEventListener('play', () => { if (el === audio) { updatePlayBtn(); jamBroadcast(); } });
  el.addEventListener('pause', () => { if (el === audio) { updatePlayBtn(); jamBroadcast(); } });
}

function seekTo(sec) {
  if (!cur) return;
  engineSeek(sec);
  jamBroadcast(true);
}

function enqueue(track) {
  queue.push(track);
  if (!cur && qIndex < 0) qIndex = 0;
  toast('Dodano v čakalno vrsto.');
  if (view === 'queue') render();
  if (!$('#side-panel').hidden) renderSidePanel();
}

const isLiked = (t) => db.liked.some((x) => x.id === t.id);
function toggleLike(t) {
  db.liked = isLiked(t) ? db.liked.filter((x) => x.id !== t.id) : [t, ...db.liked];
  save();
  updateNow();
}

async function addToPlaylist(track) {
  if (!db.playlists.length) { toast('Najprej ustvari seznam predvajanja (+ v knjižnici).'); return; }
  const id = await choose('Dodaj v seznam', db.playlists.map((p) => ({ label: p.name, value: p.id })));
  if (!id) return;
  const pl = db.playlists.find((p) => p.id === id);
  if (pl) await addTrackToPlaylist(pl, track);
}
async function addTrackToPlaylist(pl, track) {
  if (pl?.collabId) {
    if (track.type !== 'yt' || !track.videoId) return toast('V skupni seznam lahko dodaš samo YouTube skladbe.');
    if (!(await socialCall('POST', `/api/collabs/${pl.collabId}/tracks`, { track }, `Dodano v "${pl.name}".`))) return;
  } else {
    if (pl && !pl.tracks.some((t) => t.id === track.id)) {
      pl.tracks.push(track);
    }
    save();
    toast(`Dodano v "${pl.name}".`);
  }
  if (pl) {
    view = 'playlists';
    viewArg = pl.id;
    renderAll();
    renderSidebar();
    requestAnimationFrame(() => $('#content .row:last-child')?.scrollIntoView({ block: 'nearest' }));
  }
}
async function addTrackFromSearch(pl) {
  const query = await ask(`Poišči skladbo za "${pl.name}"`);
  if (!query) return;
  try {
    const results = await ytSearch(query, 25, true);
    if (!results.length) return toast('Iskanje ni našlo skladb.');
    const selected = await choose('Izberi skladbo', results.map((track, index) => ({
      label: `${track.title} — ${track.artist}`,
      value: index,
    })));
    if (selected === null || selected === undefined) return;
    const track = results[Number(selected)];
    if (track) await addTrackToPlaylist(pl, track);
  } catch (e) {
    toast(`Skladbe ni bilo mogoče dodati: ${e.message}`);
  }
}

// Icon is a 2x2 collage of the first 4 covers; only a manually chosen icon overrides it.
function collageEl(covers, cls) {
  if (covers.length === 1) return h('img', { class: cls, src: covers[0], alt: '', referrerpolicy: 'no-referrer' });
  return h('div', { class: `${cls} collage` }, [0, 1, 2, 3].map((i) => h('img', { src: covers[i % covers.length], alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' })));
}
function playlistIcon(p, cls = 'cover') {
  if (p.icon && p.icon.custom) return coverEl({ cover: p.icon.cover, title: p.icon.title || p.name }, cls);
  const covers = p.tracks.map((t) => t.cover).filter(Boolean).slice(0, 4);
  return covers.length ? collageEl(covers, cls) : coverEl({ title: p.name }, cls);
}

function imageToDataUrl(file, size = 256, keepAspect = false) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas');
      if (keepAspect) {
        const k = Math.min(1, size / Math.max(img.width, img.height));
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve({ url: c.toDataURL('image/jpeg', 0.85), ratio: c.width / c.height });
        return;
      }
      c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

async function changePlaylistIcon(pl) {
  const input = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const apply = (icon) => {
    if (icon) pl.icon = { ...icon, custom: true }; else delete pl.icon;
    save();
    renderAll();
  };
  input.addEventListener('change', async () => {
    const url = input.files[0] && await imageToDataUrl(input.files[0]);
    if (!url) { toast('Slike ni mogoče naložiti.'); return; }
    document.querySelector('#modal')?.remove();
    apply({ cover: url, title: pl.name });
  });
  const covers = pl.tracks.filter((t) => t.cover);
  const select = h('select', {}, covers.map((t, i) => h('option', { value: i }, t.title)));
  await modal('Ikona seznama', () => h('div', {},
    h('div', { class: 'note' }, 'Izberi naslovnico skladbe iz seznama, naloži svojo sliko ali vrni samodejno ikono.'),
    covers.length ? h('div', { class: 'toolbar' }, select, btn('Uporabi', () => {
      const t = covers[select.value];
      document.querySelector('#modal')?.remove();
      apply({ cover: t.cover, title: t.title });
    }, 'btn')) : null,
    h('div', { class: 'toolbar' }, input, btn('Naloži sliko', () => input.click(), 'btn sec'),
      btn('Samodejno', () => { document.querySelector('#modal')?.remove(); apply(null); }, 'btn sec'))),
  (close) => [btn('Zapri', () => close(null), 'btn sec')]);
}

async function newPlaylist() {
  const name = await ask('Ime seznama');
  if (!name) return;
  db.playlists.push({ id: rid(), name, tracks: [] });
  save();
  view = 'playlists';
  viewArg = db.playlists[db.playlists.length - 1].id;
  renderAll();
}

// ---------- Player UI ----------
function coverEl(t, cls = 'cover') {
  const cover = t.cover || (t.type === 'radio' ? radioStationLogoUrl(t.station) : '');
  if (cover) {
    return h('img', { class: cls, src: cover, loading: 'lazy', alt: '', referrerpolicy: 'no-referrer' });
  }
  const hue = [...(t.title || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return h('div', {
    class: `${cls} ph`,
    style: `background:linear-gradient(135deg,hsl(${hue} 60% 42%),hsl(${(hue + 50) % 360} 60% 22%))`,
  }, (t.title || '♪')[0].toUpperCase());
}

function updateNow() {
  const radio = cur?.type === 'radio';
  document.body.classList.toggle('radio-playing', radio);
  $('#now-title').textContent = cur ? cur.title : 'Nič se ne predvaja';
  $('#now-artist').textContent = radio ? `V ŽIVO · ${cur.station.freq}` : cur ? cur.artist : '';
  $('#btn-like').disabled = radio;
  $('#btn-addpl').disabled = radio;
  const liked = !!cur && isLiked(cur);
  $('#btn-like').innerHTML = liked ? ICON.heart : ICON.heartO;
  $('#btn-like').classList.toggle('on', liked);
  const nc = $('#now-cover');
  const cover = cur?.cover || (radio ? radioStationLogoUrl(cur.station) : '');
  if (cover) { nc.src = cover; nc.style.display = 'block'; } else nc.style.display = 'none';
  const stationButton = $('#now-station-btn');
  const stationLogo = $('#now-station-logo');
  if (radio && cover) {
    stationLogo.src = cover;
    stationButton.title = `${cur.title} · odpri slovenske radijske postaje`;
    stationButton.hidden = false;
  } else {
    stationLogo.removeAttribute('src');
    stationButton.hidden = true;
  }
  updatePlayBtn();
  syncNp();
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = cur ? new MediaMetadata({
      title: cur.title,
      artist: cur.artist,
      artwork: cover ? [{ src: cover }] : [],
    }) : null;
  }
  if (!$('#side-panel').hidden) renderSidePanel();
}
// Discord status: send only when the track, play state or position (seek) changes.
let dcLast = { id: '', playing: null, pos: 0, at: 0, on: null };
setInterval(() => {
  const on = !!db && db.settings.discord !== false && !!account;
  if (!on || !cur) {
    if (dcLast.on !== false || dcLast.id) { dcLast = { id: '', playing: null, pos: 0, at: 0, on: false }; window.gmajna.discordUpdate(null); }
    return;
  }
  const playing = isPlaying();
  const pos = getPos();
  const expected = dcLast.pos + (dcLast.playing ? (Date.now() - dcLast.at) / 1000 : 0);
  if (dcLast.id === cur.id && dcLast.playing === playing && dcLast.on && Math.abs(pos - expected) < 3) return;
  dcLast = { id: cur.id, playing, pos, at: Date.now(), on: true };
  const radio = cur.type === 'radio';
  window.gmajna.discordUpdate({
    title: cur.title, artist: radio ? 'Radio' : cur.artist, cover: cur.cover || '',
    playing, position: pos, duration: radio ? 0 : getDur(),
    url: cur.type === 'yt' && cur.videoId ? `https://www.youtube.com/watch?v=${cur.videoId}` : '',
  });
}, 2000);

function updatePlayBtn() {
  const playing = isPlaying();
  $('#btn-play').innerHTML = playing ? ICON.pause : ICON.play;
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = cur ? (playing ? 'playing' : 'paused') : 'none';
}

setInterval(() => {
  if (!cur) return;
  const pos = getPos();
  const dur = getDur();
  if (!seeking) {
    $('#seek').value = dur ? Math.round((pos / dur) * 1000) : 0;
    $('#pos').textContent = fmt(pos);
    $('#dur').textContent = fmt(dur);
  }
  updatePlayBtn();
  syncNp();
}, 400);

// Crossfade: the next track starts when `fade` seconds remain, so both fade over the same period.
let xfadeBusy = false;
let sleepMul = 1;
let sleepFade = null;
let xfadeFailed = '';
const fadeLevel = (pos, dur, f, fadeIn) => (f > 0 && dur ? Math.max(0, Math.min(1, fadeIn ? pos / f : 1, (dur - pos) / f)) : 1);
function setDeckLevel(deck, g) {
  g *= sleepMul;
  if (deck.type === 'yt') deck.p.setVolume?.(Math.round(db.settings.volume * g));
  else if (deckGain.length) deckGain[audioEls.indexOf(deck.el)].gain.value = g;
}
async function startCrossfade(t) {
  xfadeBusy = true;
  qIndex = queue.indexOf(t);
  const ok = await playTrack(t, { cross: true });
  if (!ok) xfadeFailed = cur ? cur.id : '';
  xfadeBusy = false;
}
setInterval(() => {
  if (!cur) return;
  const f = Number(db.settings.fade) || 0;
  const skipO = Number(db.settings.skipOutro) || 0;
  const pos = getPos();
  const rawDur = getDur();
  const dur = rawDur ? Math.max(0, rawDur - skipO) : 0;
  if (loopA !== null && loopB !== null && !seeking && !jamGuest()) {
    if (pos >= loopB || pos < loopA - 0.5) seekTo(loopA);
    return;
  }
  setDeckLevel(ytActive() ? { type: 'yt', p: yt } : { type: 'local', el: audio }, fadeLevel(pos - curStart, dur - curStart, f, true));
  if (ghost) {
    const gp = ghost.type === 'yt' ? ghost.p.getCurrentTime?.() || 0 : ghost.el.currentTime;
    const gdRaw = ghost.type === 'yt' ? ghost.p.getDuration?.() || 0 : ghost.el.duration;
    const gd = gdRaw - skipO;
    const gone = ghost.type === 'yt' ? ghost.p.__st === 0 : ghost.el.ended || ghost.el.paused;
    if (gone || !isFinite(gd) || gd <= 0 || gd - gp < 0.1) killGhost();
    else setDeckLevel(ghost, fadeLevel(gp, gd, f, false));
  }
  if (radioOn() && cur.type === 'yt' && repeat === 'off' && !jamGuest() && queue.length - 1 - qIndex < 15 && radioFailedFor !== cur.id) radioFill();
  if (!rawDur || xfadeBusy || jamGuest() || repeat === 'one' || !isPlaying()) return;
  if (f > 0 && dur > f * 2 && dur - pos <= f && xfadeFailed !== cur.id) {
    const t = pickNext(true);
    if (t) startCrossfade(t);
  } else if (skipO > 0 && f === 0 && dur - pos <= 0 && outroDone !== cur.id && rawDur > skipO * 2) {
    outroDone = cur.id;
    next(true);
  }
}, 100);

$('#seek').addEventListener('input', () => { seeking = true; $('#pos').textContent = fmt((getDur() * $('#seek').value) / 1000); });
$('#seek').addEventListener('change', () => {
  seeking = false;
  if (jamGuest()) return;
  seekTo((getDur() * $('#seek').value) / 1000);
});
$('#btn-play').onclick = togglePlay;
$('#btn-next').onclick = () => next(false);
$('#btn-prev').onclick = prev;
$('#btn-shuffle').onclick = cycleShuffle;
$('#btn-repeat').onclick = () => {
  repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off';
  const b = $('#btn-repeat');
  b.classList.toggle('on', repeat !== 'off');
  b.innerHTML = ICON.repeat + (repeat === 'one' ? '<sup>1</sup>' : '');
};
for (const [id, icon] of [['#btn-shuffle', ICON.shuffle], ['#btn-prev', ICON.prev], ['#btn-next', ICON.next],
  ['#btn-repeat', ICON.repeat], ['#btn-viz', ICON.viz], ['#btn-lyrics', ICON.now], ['#btn-lyr', ICON.lyr], ['#btn-queue', ICON.queue], ['#btn-mini', ICON.mini]]) {
  $(id).innerHTML = icon;
}
$('#btn-home').innerHTML = ICON.home;
$('#now-station-btn').onclick = () => {
  view = 'stations';
  viewArg = null;
  renderAll();
};
$('#btn-viz').onclick = () => { view = 'visualizer'; viewArg = null; renderAll(); };
$('#btn-like').innerHTML = ICON.heartO;
$('#btn-addpl').innerHTML = ICON.plus;
$('#btn-addpl').onclick = () => { if (cur) addToPlaylist(cur); else toast('Najprej predvajaj skladbo.'); };
updatePlayBtn();
$('#btn-like').onclick = () => { if (cur) { toggleLike(cur); if (view === 'liked') render(); renderSidebar(); } };
$('#btn-mini').onclick = () => {
  const on = !document.body.classList.contains('mini');
  document.body.classList.toggle('mini', on);
  window.gmajna.setMini(on);
  $('#btn-mini').title = on ? 'Nazaj na celotno aplikacijo' : 'Mini predvajalnik';
};
let fullscreen = false;
const toggleFullscreen = async () => { fullscreen = await window.gmajna.setFullscreen(!fullscreen); };

// Falling, swirling dots over the whole UI; they follow the theme colour and speed up with the bass.
const pCanvas = h('canvas', { id: 'particles' });
document.body.append(pCanvas);
let pRaf = 0;
let pT = 0;
const pDots = Array.from({ length: 90 }, () => ({
  x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, ph: Math.random() * 6.28, sw: 0.3 + Math.random() * 1.2,
}));
const snowFlakes = Array.from({ length: 70 }, () => ({
  x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, ph: Math.random() * 6.28,
}));
function drawSnow(ctx, w, hh, e) {
  for (const d of snowFlakes) {
    d.y += (0.0005 + 0.001 * d.z) * (1 + e * 1.5);
    d.ph += 0.012;
    if (d.y > 1.02) { d.y = -0.02; d.x = Math.random(); }
    const x = (d.x + 0.015 * Math.sin(d.ph + d.y * 6)) * w;
    const y = d.y * hh;
    const r = 1 + d.z * 1.8;
    ctx.strokeStyle = `rgba(255,255,255,${0.25 + d.z * 0.4})`;
    ctx.lineWidth = Math.max(1, d.z * 1.4);
    ctx.lineCap = 'round';
    for (let a = 0; a < 6; a++) {
      const angle = a * Math.PI / 3 + d.ph * 0.12;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * r * 2.8, y + Math.sin(angle) * r * 2.8);
      ctx.stroke();
    }
  }
  const box = $('#content')?.getBoundingClientRect();
  const cx = box ? box.left : 0;
  const cw = box ? box.width : w;
  const cb = box ? box.bottom : hh;
  const g = ctx.createLinearGradient(0, cb - 46, 0, cb);
  g.addColorStop(0, 'rgba(235,245,255,0)');
  g.addColorStop(1, 'rgba(235,245,255,0.55)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, cb);
  for (let x = 0; x <= cw; x += 14) ctx.lineTo(cx + x, cb - 18 - 6 * Math.sin(x / 90) - 3 * Math.sin(x / 27 + 1));
  ctx.lineTo(cx + cw, cb);
  ctx.closePath();
  ctx.fill();
}
function startParticles() {
  document.body.classList.toggle('xmas', !!db.settings.snow);
  const on = db.settings.particles !== false;
  pCanvas.style.display = on ? 'block' : 'none';
  if (on && !pRaf) pRaf = requestAnimationFrame(pLoop);
}
function pLoop() {
  pRaf = 0;
  if (db.settings.particles === false || document.hidden) { if (db.settings.particles !== false) pRaf = requestAnimationFrame(pLoop); return; }
  pRaf = requestAnimationFrame(pLoop);
  const w = innerWidth;
  const hh = innerHeight;
  if (pCanvas.width !== w || pCanvas.height !== hh) { pCanvas.width = w; pCanvas.height = hh; }
  const ctx = pCanvas.getContext('2d');
  ctx.clearRect(0, 0, w, hh);
  let e = 0;
  if (cur && isPlaying()) {
    if (analyser && !audio.paused) {
      analyser.getByteFrequencyData(vizData);
      for (let i = 0; i < 6; i++) e += vizData[i] / 255 / 6;
    } else e = 0.25 + 0.15 * Math.sin(pT * 2);
  }
  pT += 0.016;
  if (db.settings.snow) { drawSnow(ctx, w, hh, e); return; }
  const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#1ed760';
  const hue = hexHue(accent);
  for (const d of pDots) {
    d.y += (0.00035 + 0.0007 * d.z) * (1 + e * 3);
    d.ph += 0.01 * d.sw;
    if (d.y > 1.02) { d.y = -0.02; d.x = Math.random(); }
    const x = (d.x + 0.018 * Math.sin(d.ph + d.y * 8)) * w;
    const y = d.y * hh;
    const r = (0.8 + d.z * 1.4) * (1 + e * 0.8);
    ctx.fillStyle = `hsla(${(hue + 50 * Math.sin(d.ph) + 30) % 360},90%,72%,${0.15 + d.z * 0.35 + e * 0.25})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.283);
    ctx.fill();
  }
}

// Full-screen "now playing" view: large video/cover, big controls, ambient backdrop.
let npOpen = false;
let npEnteredFs = false;
let npTrackId = null;
let npSeeking = false;
let npIdleTimer = 0;
const npRefs = {};
function buildNp() {
  const ibtn = (id, icon, title, fn, cls = '') => {
    const b = h('button', { class: `npb ${cls}`, title, onclick: fn });
    b.innerHTML = icon;
    npRefs[id] = b;
    return b;
  };
  npRefs.art = h('div', { class: 'np-art' });
  npRefs.title = h('div', { class: 'np-title' });
  npRefs.artist = h('div', { class: 'np-artist' });
  npRefs.pos = h('span', {}, '0:00');
  npRefs.dur = h('span', {}, '0:00');
  npRefs.seek = h('input', { type: 'range', min: 0, max: 1000, value: 0 });
  npRefs.seek.addEventListener('input', () => { npSeeking = true; npRefs.pos.textContent = fmt((getDur() * npRefs.seek.value) / 1000); });
  npRefs.seek.addEventListener('change', () => { npSeeking = false; if (!jamGuest()) seekTo((getDur() * npRefs.seek.value) / 1000); });
  npRefs.vol = h('input', { type: 'range', min: 0, max: 100, value: db.settings.volume });
  npRefs.vol.addEventListener('input', () => { $('#volume').value = npRefs.vol.value; $('#volume').dispatchEvent(new Event('input')); });
  npRefs.viz = h('canvas', { class: 'np-viz' });
  npRefs.list = h('div', { class: 'np-list' });
  const el = h('div', { id: 'np', hidden: true },
    h('button', { class: 'np-close', title: 'Zapri (Esc)', onclick: closeNp }, '✕'),
    h('div', { class: 'np-side np-left' }, npRefs.viz),
    h('span', { class: 'brand-whole np-logo', role: 'img', 'aria-label': 'Rythmify' }),
    h('div', { class: 'np-side np-right' }, h('div', { class: 'np-sh' }, 'Naslednje'), npRefs.list),
    npRefs.art,
    h('div', { class: 'np-lyrics' }, lyricsBox('np-box')),
    h('div', { class: 'np-body' },
      h('div', { class: 'np-meta' }, npRefs.title, npRefs.artist),
      h('div', { class: 'np-seek' }, npRefs.pos, npRefs.seek, npRefs.dur),
      h('div', { class: 'np-ctrl' },
        ibtn('shuffle', ICON.shuffle, 'Naključno', () => $('#btn-shuffle').click()),
        ibtn('prev', ICON.prev, 'Prejšnja', prev),
        ibtn('play', ICON.play, 'Predvajaj/pavza', togglePlay, 'big'),
        ibtn('next', ICON.next, 'Naslednja', () => next(false)),
        ibtn('repeat', ICON.repeat, 'Ponovi', () => $('#btn-repeat').click())),
      h('div', { class: 'np-extra' },
        ibtn('like', ICON.heartO, 'Všeček', () => { if (cur) { toggleLike(cur); syncNp(); renderSidebar(); } }),
        ibtn('lyr', ICON.lyr, 'Besedilo', () => {
          const on = document.body.classList.toggle('np-lyrics');
          npRefs.lyr.classList.toggle('on', on);
        }),
        h('div', { class: 'np-vol' }, npRefs.vol))));
  document.body.append(el);
  el.addEventListener('mousemove', npWake);
  return el;
}
function npWake() {
  document.body.classList.remove('np-idle');
  clearTimeout(npIdleTimer);
  npIdleTimer = setTimeout(() => document.body.classList.add('np-idle'), 3000);
}
let npListKey = '';
function npRenderList() {
  const upcoming = queue.slice(qIndex + 1).filter((t) => !ytBlocked.has(t.id)).slice(0, 40);
  const key = `${cur ? cur.id : ''}|${upcoming.map((t) => t.id).join(',')}`;
  if (key === npListKey) return;
  npListKey = key;
  npRefs.list.replaceChildren(...(upcoming.length
    ? upcoming.map((t) => h('div', { class: 'qrow', onclick: () => { qIndex = queue.indexOf(t); playTrack(t); } },
      coverEl(t), h('div', { style: 'min-width:0' }, h('div', { class: 'qt' }, t.title), h('div', { class: 'qa' }, t.artist))))
    : [h('div', { class: 'note' }, 'Ni naslednjih skladb.')]));
}

// Visualizer on the left of the full-screen view: real spectrum for offline files, a gentle animation for YouTube.
let npVizRaf = 0;
let npPhase = 0;
function npVizLoop() {
  if (!npOpen) { npVizRaf = 0; return; }
  npVizRaf = requestAnimationFrame(npVizLoop);
  const c = npRefs.viz;
  const w = c.clientWidth;
  const hh = c.clientHeight;
  if (!w || !hh) return;
  if (c.width !== w || c.height !== hh) { c.width = w; c.height = hh; }
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, hh);
  const n = 32;
  const data = new Float32Array(n);
  if (cur && analyser && !audio.paused) {
    analyser.getByteFrequencyData(vizData);
    for (let i = 0; i < n; i++) data[i] = vizData[Math.floor((i / n) * 140)] / 255;
  } else if (cur && isPlaying()) {
    npPhase += 0.08;
    for (let i = 0; i < n; i++) data[i] = 0.3 + 0.22 * Math.sin(npPhase + i * 0.45) + 0.12 * Math.sin(npPhase * 1.7 + i * 0.2);
  }
  for (let i = 0; i < n; i++) npSm[i] += (data[i] - npSm[i]) * 0.5;
  let bass = 0;
  for (let i = 0; i < 5; i++) bass += npSm[i] / 5;
  npPulse += (bass - npPulse) * 0.4;
  npRot += 0.012 + npPulse * 0.05 + (cur && isPlaying() ? 0.006 : 0);
  npTime += 0.035 + npPulse * 0.05;
  const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#1ed760';
  const hue = hexHue(accent);
  const R = Math.min(w, hh) * 0.25 * (1 + npPulse * 0.12);
  const cx = w / 2;
  const cy = hh / 2;
  const LAT = 22;
  const LON = 36;
  const cosX = Math.cos(0.45);
  const sinX = Math.sin(0.45);
  const vert = (th, ph, k = 1) => {
    // longitude drives which frequency band bulges the surface
    const band = npSm[Math.floor(((ph / (Math.PI * 2)) * 2 % 1) * n) % n] || 0;
    const wob = 0.08 * Math.sin(th * 3 + npTime * 2) * Math.sin(ph * 2 + npTime * 1.3) + 0.03 * Math.sin(th * 5 - npTime * 3 + ph * 3);
    const r = k * (1 + wob + Math.min(band, 1) * 0.45 * Math.sin(th));
    const x0 = r * Math.sin(th) * Math.cos(ph + npRot);
    const y0 = r * Math.cos(th);
    const z0 = r * Math.sin(th) * Math.sin(ph + npRot);
    const y1 = y0 * cosX - z0 * sinX;
    const z1 = y0 * sinX + z0 * cosX;
    const p = 4.5 / (4.5 + z1);
    return [cx + x0 * R * p, cy + y1 * R * p, z1];
  };
  ctx.lineWidth = 1;
  ctx.shadowBlur = 8;
  const seg = (a, b, ph) => {
    const depth = (a[2] + b[2]) / 2;
    const hh2 = (hue + 70 * Math.sin(ph + npRot) + 40) % 360;
    ctx.strokeStyle = `hsla(${hh2},90%,${62 - depth * 14}%,${0.8 - depth * 0.35})`;
    ctx.shadowColor = `hsl(${hh2},100%,60%)`;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };
  for (let i = 1; i < LAT; i++) {
    const th = (i / LAT) * Math.PI;
    let prev = vert(th, 0);
    for (let j = 1; j <= LON; j++) {
      const ph = (j / LON) * Math.PI * 2;
      const cur2 = vert(th, ph);
      seg(prev, cur2, ph);
      prev = cur2;
    }
  }
  for (let j = 0; j < LON; j++) {
    const ph = (j / LON) * Math.PI * 2;
    let prev = vert(0, ph);
    for (let i = 1; i <= LAT; i++) {
      const cur2 = vert((i / LAT) * Math.PI, ph);
      seg(prev, cur2, ph);
      prev = cur2;
    }
  }
  ctx.shadowBlur = 0;
  for (const d of npDots) {
    const e = npSm[d.b % n] || 0;
    const q = vert(d.th, d.ph + npTime * 0.1, 1.18 + d.k * 0.3 + e * 0.25);
    ctx.fillStyle = `hsla(${(hue + 70 * Math.sin(d.ph + npRot) + 40) % 360},95%,70%,${0.25 + e * 0.5})`;
    ctx.fillRect(q[0], q[1], 1.6, 1.6);
  }
}
const npSm = new Float32Array(32);
let npPulse = 0;
let npRot = 0;
let npTime = 0;
const npDots = Array.from({ length: 220 }, () => ({ th: Math.acos(2 * Math.random() - 1), ph: Math.random() * Math.PI * 2, k: Math.random(), b: Math.floor(Math.random() * 32) }));
function hexHue(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 150;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255);
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  if (!d) return 200;
  const hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (hh * 60 + 360) % 360;
}
function syncNp() {
  if (!npOpen) return;
  npRenderList();
  if (!npVizRaf) npVizLoop();
  const t = cur;
  if ((t ? t.id : null) !== npTrackId) {
    npTrackId = t ? t.id : null;
    npRefs.art.replaceChildren(...(t && t.type !== 'yt' ? [coverEl(t, 'np-cover')] : []));
    document.body.classList.toggle('np-video', !!t && t.type === 'yt');
  }
  npRefs.title.textContent = t ? t.title : 'Nič se ne predvaja';
  npRefs.artist.textContent = t ? t.artist : '';
  if (!npSeeking) {
    const pos = getPos();
    const dur = getDur();
    npRefs.seek.value = dur ? Math.round((pos / dur) * 1000) : 0;
    npRefs.pos.textContent = fmt(pos);
    npRefs.dur.textContent = fmt(dur);
  }
  npRefs.play.innerHTML = isPlaying() ? ICON.pause : ICON.play;
  npRefs.like.innerHTML = t && isLiked(t) ? ICON.heart : ICON.heartO;
  npRefs.like.classList.toggle('on', !!t && isLiked(t));
  npRefs.shuffle.classList.toggle('on', shuffle);
  npRefs.shuffle.innerHTML = smart ? ICON.smartShuffle : ICON.shuffle;
  npRefs.repeat.classList.toggle('on', repeat !== 'off');
  if (document.activeElement !== npRefs.vol) npRefs.vol.value = db.settings.volume;
}
async function openNp() {
  if (npOpen) return;
  let el = $('#np');
  if (!el) el = buildNp();
  if (document.body.classList.contains('mini')) $('#btn-mini').click();
  npOpen = true;
  npTrackId = undefined;
  el.hidden = false;
  document.body.classList.add('np');
  closeLyricsFull();
  if (!fullscreen) { await toggleFullscreen(); npEnteredFs = true; }
  syncNp();
  npWake();
}
async function closeNp() {
  if (!npOpen) return;
  npOpen = false;
  $('#np').hidden = true;
  document.body.classList.remove('np', 'np-video', 'np-idle', 'np-lyrics');
  npRefs.lyr?.classList.remove('on');
  clearTimeout(npIdleTimer);
  if (npEnteredFs && fullscreen) await toggleFullscreen();
  npEnteredFs = false;
}
$('#btn-full').onclick = () => (npOpen ? closeNp() : openNp());

// Theater mode: the YouTube video fills the main content area.
let theater = false;
function layoutTheater() {
  const r = $('#content').getBoundingClientRect();
  const s = document.documentElement.style;
  s.setProperty('--tx', `${r.left}px`);
  s.setProperty('--ty', `${r.top}px`);
  s.setProperty('--tw', `${r.width}px`);
  s.setProperty('--th', `${r.height}px`);
}
function setTheater(on) {
  theater = on;
  document.body.classList.toggle('theater', on);
  $('#btn-theater').classList.toggle('on', on);
  if (on) layoutTheater();
}
$('#btn-theater').innerHTML = svg('M3 5h18v14H3zm2 2v10h14V7z', 18);
$('#btn-theater').onclick = () => {
  if (!theater && !(cur && cur.type === 'yt')) { toast('Prikaz velja za YouTube videe.'); return; }
  setTheater(!theater);
};
new ResizeObserver(() => { if (theater) layoutTheater(); }).observe($('#content'));
for (const sel of ['#sidebar', '#btn-home', '#avatar-btn']) $(sel).addEventListener('click', () => setTheater(false), true);
$('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') setTheater(false); });
$('#btn-full').title = 'Celozaslonski prikaz predvajanja';
$('#btn-full').innerHTML = svg('M5 5h5v2H7v3H5zm9 0h5v5h-2V7h-3zM5 14h2v3h3v2H5zm12 0h2v5h-5v-2h3z', 18);
document.addEventListener('keydown', (e) => {
  if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); }
  if (e.key === 'Escape') { if (npOpen) closeNp(); else if (fullscreen) toggleFullscreen(); }
});
$('#btn-queue').onclick = () => toggleSide();
$('#btn-lyrics').onclick = () => toggleSide();
function toggleSide(show) {
  const p = $('#side-panel');
  p.hidden = show === undefined ? !p.hidden : !show;
  $('#app').classList.toggle('with-side', !p.hidden);
  $('#btn-lyrics').classList.toggle('on', !p.hidden);
  $('#btn-queue').classList.toggle('on', !p.hidden);
  if (!p.hidden) renderSidePanel();
}
$('#volume').addEventListener('input', () => {
  const v = Number($('#volume').value);
  db.settings.volume = v;
  for (const el of audioEls) el.volume = v / 100;
  radioAudio.volume = v / 100;
  save();
});

function renderSidePanel() {
  const p = $('#side-panel');
  p.replaceChildren();
  if (!cur) { p.append(h('div', { class: 'note' }, 'Izberi skladbo.')); return; }
  const id = cur.id;
  const area = h('textarea', { placeholder: 'Prilepi besedilo skladbe …' });
  area.value = db.lyrics[id] || '';
  area.addEventListener('input', () => { db.lyrics[id] = area.value; save(); });
  const upcoming = queue.slice(qIndex + 1).filter((t) => !ytBlocked.has(t.id));
  const nextList = upcoming.length
    ? upcoming.slice(0, 60).map((t) => h('div', { class: 'qrow', onclick: () => { qIndex = queue.indexOf(t); playTrack(t); } },
      coverEl(t), h('div', { style: 'min-width:0' }, h('div', { class: 'qt' }, t.title), h('div', { class: 'qa' }, t.artist))))
    : [h('div', { class: 'note' }, smart && plQueue ? 'Pametno naključno bo kmalu dodalo skladbe.' : 'Ni naslednjih skladb.')];
  const lyr = h('div', { class: 'lyr' },
    h('div', { class: 'lyr-head' }, h('b', {}, 'Besedilo'), btn('Čez cel zaslon', openLyricsFull, 'btn sec')),
    lyricsBox('side-box'),
    h('details', {}, h('summary', {}, 'Dodaj svoje besedilo'), area));
  p.append(coverEl(cur, 'big'), h('div', { class: 'st' }, cur.title), h('div', { class: 'sa' }, cur.artist),
    h('h3', { class: 'qh' }, 'Naslednje'), h('div', { class: 'qlist' }, nextList), lyr);
}

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', togglePlay);
  navigator.mediaSession.setActionHandler('pause', togglePlay);
  navigator.mediaSession.setActionHandler('nexttrack', () => next(false));
  navigator.mediaSession.setActionHandler('previoustrack', prev);
}
window.gmajna.onMedia((a) => { if (a === 'toggle') togglePlay(); else if (a === 'next') next(false); else prev(); });
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input,textarea,select')) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
});

// ---------- Components ----------
function trackRow(track, list, extra) {
  const playing = cur && cur.id === track.id;
  return h('div', { class: 'row' + (playing ? ' playing' : '') },
    coverEl(track),
    h('div', { style: 'min-width:0' },
      h('div', {}, h('span', { class: 't', onclick: () => playFrom(list, track) }, track.title),
        h('span', { class: 'badge' }, track.type === 'yt' ? 'YOUTUBE' : 'OFFLINE')),
      h('div', { class: 'a' }, track.artist)),
    h('div', { class: 'acts' },
      btn('+ vrsta', () => enqueue(track)),
      btn(isLiked(track) ? '♥' : '♡', () => { toggleLike(track); render(); renderSidebar(); }),
      btn('Seznam', () => addToPlaylist(track)),
      extra));
}
const trackRows = (tracks, empty, extraFor) => (tracks.length
  ? tracks.map((t) => trackRow(t, tracks, extraFor && extraFor(t)))
  : [h('div', { class: 'note' }, empty)]);

const cardEl = (track, list) => h('div', { class: 'card', onclick: () => playFrom(list, track) },
  coverEl(track), h('button', { class: 'playfab' }, '▶'),
  h('div', { class: 'ct' }, track.title), h('div', { class: 'ca' }, track.artist));
const cardGrid = (tracks) => h('div', { class: 'grid' }, tracks.map((t) => cardEl(t, tracks)));

const section = (title, tracks, empty) => [
  h('h3', {}, title),
  tracks.length ? cardGrid(tracks) : h('div', { class: 'note' }, empty),
];

function hero(...kids) { return h('div', { class: 'hero' }, kids); }

// ---------- YouTube Music search (via the built-in InnerTube client) ----------
const ytCache = new Map();
async function ytSearch(q, limit = 25, songsOnly = false) {
  const ck = [q, limit, songsOnly].join('|');
  const hit = ytCache.get(ck) || (() => { try { return JSON.parse(localStorage.getItem('ytc:' + ck)); } catch { return null; } })();
  if (hit && Date.now() - hit.t < 864e5) return hit.v;
  const v = await ytSearchRaw(q, limit, songsOnly);
  if (v.length) { const e = { t: Date.now(), v }; ytCache.set(ck, e); try { localStorage.setItem('ytc:' + ck, JSON.stringify(e)); } catch { /* storage full */ } }
  return v;
}
async function ytSearchRaw(q, limit = 25, songsOnly = false) {
  const found = await window.gmajna.ytSearch(q);
  const items = found.filter((t) => !songsOnly || (t.seconds >= 90 && t.seconds <= 480)).slice(0, songsOnly ? 50 : limit);
  return items.map((t) => ({
    id: `yt:${t.videoId}`, type: 'yt', videoId: t.videoId,
    title: decode(t.title), artist: decode(t.artist), cover: t.cover,
  }));
}

// ---------- Spotify (Web API, PKCE login; only used to import playlists) ----------
const SPOTIFY_ID = 'feb8ad87f45349a39b853510476b18bb';
const SPOTIFY_REDIRECT = 'http://127.0.0.1:38457/callback';
let spVerifier = '', spState = '';
let spAuth = (() => { try { return JSON.parse(localStorage.getItem('spotify')); } catch { return null; } })();
const spSave = (v) => { spAuth = v; if (v) localStorage.setItem('spotify', JSON.stringify(v)); else localStorage.removeItem('spotify'); };
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function spConnect() {
  const raw = crypto.getRandomValues(new Uint8Array(48));
  spVerifier = b64url(raw);
  spState = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(spVerifier)));
  const u = new URL('https://accounts.spotify.com/authorize');
  u.search = new URLSearchParams({
    client_id: SPOTIFY_ID, response_type: 'code', redirect_uri: SPOTIFY_REDIRECT, state: spState,
    code_challenge_method: 'S256', code_challenge: challenge, scope: 'playlist-read-private playlist-read-collaborative',
  });
  window.gmajna.openExternal(u.toString());
  toast('Odpiram Spotify prijavo v brskalniku…');
}
async function spToken(params) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: SPOTIFY_ID, ...params }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.error || `Napaka ${r.status}`);
  spSave({ access: j.access_token, refresh: j.refresh_token || spAuth?.refresh || '', exp: Date.now() + (j.expires_in - 60) * 1000 });
  save();
}
window.gmajna.onSpotify(async ({ code, error, state }) => {
  if (error || !code || state !== spState) { toast('Spotify prijava ni uspela.'); return; }
  try {
    await spToken({ grant_type: 'authorization_code', code, redirect_uri: SPOTIFY_REDIRECT, code_verifier: spVerifier });
    toast('Spotify povezan.');
    if (view === 'settings') render();
  } catch (e) { toast(`Spotify: ${e.message}`); }
});
async function spApi(url) {
  const s = spAuth;
  if (!s?.access) throw new Error('Spotify ni povezan.');
  if (Date.now() > s.exp) await spToken({ grant_type: 'refresh_token', refresh_token: s.refresh });
  const r = await fetch(url, { headers: { Authorization: `Bearer ${spAuth.access}` } });
  if (r.status === 429) throw new Error(`Preveč zahtev, poskusi čez ${r.headers.get('Retry-After') || 30} s.`);
  if (r.status === 403) throw new Error('Spotify zavrača dostop (403). Možni razlogi: (1) tvoj Spotify e-mail še ni dodan v User Management aplikacije, (2) seznam je Spotifyjev samodejni mix (Daily Mix, Radio ...), ki ga API ne da, (3) seznam ni tvoj ali skupen. Rešitev: mix kopiraj v svoj seznam (označi vse skladbe → Dodaj na seznam → Nov seznam) in uvozi tega; prosi lastnika aplikacije, naj doda tvoj e-mail.');
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || `Napaka ${r.status}`);
  return j;
}
async function spAll(url) {
  const out = [];
  while (url) { const j = await spApi(url); out.push(...(j.items || [])); url = j.next; }
  return out;
}
function spDisconnect() { spSave(null); toast('Spotify odklopljen.'); render(); }
// Imported tracks have no videoId yet; it is looked up (and cached) the first time they are played.
async function spImport() {
  try {
    const lists = (await spAll('https://api.spotify.com/v1/me/playlists?limit=50')).filter(Boolean);
    if (!lists.length) return toast('Na Spotifyju ni seznamov.');
    const pick = await choose('Uvozi Spotify seznam', lists.map((p, i) => ({ label: p.name, value: i })));
    if (pick === null || pick === undefined) return;
    const p = lists[Number(pick)];
    if (!p) return;
    toast('Uvažam…');
    const items = await spAll(`https://api.spotify.com/v1/playlists/${p.id}/items?limit=50`);
    const tracks = items.map((i) => i.item || i.track).filter((t) => t && t.id).map((t) => ({
      id: `sp:${t.id}`, type: 'yt', videoId: '', q: `${t.artists?.[0]?.name || ''} ${t.name}`.trim(),
      title: t.name, artist: (t.artists || []).map((a) => a.name).join(', '),
      cover: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || '',
    }));
    db.playlists.push({ id: rid(), name: p.name, tracks, source: 'spotify' });
    save();
    toast(`Uvoženo: ${p.name} (${tracks.length})`);
    renderAll();
  } catch (e) { toast(`Spotify: ${e.message}`); }
}

async function doSearch(q) {
  searchState = { q, results: null, error: '' };
  view = 'search';
  if (!q) { renderAll(); return; }
  if (!navigator.onLine) searchState.error = 'Brez povezave.';
  else {
    try { searchState.results = await ytSearch(q); } catch (e) { searchState.error = e.message; }
  }
  renderAll();
}
$('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch($('#q').value.trim()); });
$('#btn-home').onclick = () => { view = 'home'; viewArg = null; renderAll(); };

// ---------- Friends & shared playlists ----------
let social = { friends: [], incoming: [], outgoing: [], results: [], q: '', sig: '', last: 0 };
const cloudOn = () => !!(account && account.token);
const userDot = (u, size = 36) => h('span', { style: `display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${u.color || '#555'};color:#000;font-weight:700;flex:none` }, (u.name || '?')[0].toUpperCase());
async function socialRefresh(force) {
  if (!cloudOn() || (!force && Date.now() - social.last < 5000)) return;
  social.last = Date.now();
  const [f, c] = await Promise.all([cloud('GET', '/api/friends', null, account.token), cloud('GET', '/api/collabs', null, account.token)]);
  if (f.ok) { social.friends = f.json.friends; social.incoming = f.json.incoming; social.outgoing = f.json.outgoing; }
  if (c.ok) {
    const ids = new Set();
    for (const s of c.json.collabs) {
      ids.add(s.id);
      let p = db.playlists.find((x) => x.collabId === s.id);
      if (!p) { p = { id: rid(), name: s.name, tracks: [], collabId: s.id }; db.playlists.push(p); }
      p.name = s.name; p.tracks = s.tracks; p.members = s.members; p.owner = s.owner;
    }
    db.playlists = db.playlists.filter((p) => !p.collabId || ids.has(p.collabId));
  }
  const sig = JSON.stringify([social.friends, social.incoming, social.outgoing, db.playlists.filter((p) => p.collabId).map((p) => [p.collabId, p.name, p.tracks.length, p.members?.length])]);
  if (sig !== social.sig) {
    const first = social.sig === '';
    social.sig = sig;
    if (!first || c.ok) save();
    if (['users', 'playlists', 'home'].includes(view)) renderAll(); else renderSidebar();
  }
}
setInterval(() => { if (!document.hidden) socialRefresh(); }, 20000);
setTimeout(() => socialRefresh(true), 4000);
async function socialCall(method, path, body, okMsg) {
  const r = await cloud(method, path, body, account.token);
  if (!r.ok) { toast(r.json.error || 'Napaka povezave.'); return false; }
  if (okMsg) toast(okMsg);
  await socialRefresh(true);
  return true;
}
async function searchUsers(q) {
  social.q = q;
  const r = q.length >= 2 ? await cloud('GET', '/api/users?q=' + encodeURIComponent(q), null, account.token) : { ok: true, json: { users: [] } };
  social.results = r.ok ? r.json.users : [];
  render();
}
async function makeShared(pl) {
  const r = await cloud('POST', '/api/collabs', { name: pl.name, tracks: pl.tracks.filter((t) => t.type === 'yt' && t.videoId) }, account.token);
  if (!r.ok) return toast(r.json.error || 'Napaka povezave.');
  pl.collabId = r.json.id;
  save();
  await socialRefresh(true);
  toast('Seznam je zdaj skupen. Povabi prijatelje.');
}
async function inviteToPlaylist(pl) {
  await socialRefresh(true);
  const have = new Set((pl.members || []).map((m) => m.id));
  const options = social.friends.filter((f) => !have.has(f.id)).map((f) => ({ label: f.name, value: f.id }));
  if (!options.length) return toast('Ni prijateljev za povabilo. Dodaj jih v zavihku Uporabniki.');
  const id = await choose('Povabi prijatelja', options);
  if (id) await socialCall('POST', `/api/collabs/${pl.collabId}/invite`, { userId: id }, 'Prijatelj je dodan v seznam.');
}

// ---------- Views ----------
const mixCache = {};
const MOODS = [
  ['Poživitev', 'energetic upbeat songs'], ['Sproščanje', 'relaxing songs'],
  ['Dobro počutje', 'feel good happy songs'], ['Vadba', 'workout gym songs'],
  ['Vožnja', 'driving road trip songs'], ['Zabava', 'party hit songs'],
  ['Zbranost', 'lofi focus study music'], ['Žalostno', 'sad songs'],
  ['Romantika', 'romantic love songs'], ['Spanje', 'calm sleep music'],
];
const SPECIAL_MIXES = [
  { key: 'si', title: 'Slovenska glasba', sub: 'Slovenske skladbe', region: 'si', q: ['slovenski izvajalci hiti', 'slovenska glasba pop rock'] },
  { key: 'yu', title: 'Yugo glasba', sub: 'Glasba iz nekdanje Jugoslavije', region: 'yu', q: ['ex yu hitovi', 'ex yu pop rock hitovi', 'muzika bivse jugoslavije hitovi'] },
  { key: 'folk', title: 'Narodna in folk', sub: 'Narodnozabavna, polka, harmonika', region: 'si', q: ['slovenska narodnozabavna glasba', 'slovenska polka harmonika'] },
];
const moodMix = ([l, q]) => ({ key: `m:${l}`, title: l, sub: 'Razpoloženjski miks', q: [q] });
const GENRES = [
  ['Pop', 'pop hit songs'], ['Rock', 'classic rock hits'], ['Hip-hop', 'hip hop rap hits'], ['Elektronska', 'electronic dance songs'],
  ['House', 'house music songs'], ['Techno', 'techno tracks'], ['Jazz', 'jazz songs'], ['Klasika', 'classical music playlist'],
  ['Country', 'country music hits'], ['Reggae', 'reggae songs'], ['Metal', 'heavy metal songs'], ['R&B', 'rnb soul hits'],
  ['Latino', 'latin pop reggaeton hits'], ['Indie', 'indie alternative songs'], ['Lo-fi', 'lofi hip hop beats'], ['Akustika', 'acoustic songs'],
].map(([l, q]) => ({ key: `g:${l}`, title: l, sub: 'Glasbeni slog', q: [q] }));
const DECADES = [
  ['60. leta', '60s music hits'], ['70. leta', '70s music hits'], ['80. leta', '80s hit songs'], ['90. leta', '90s hit songs'],
  ['2000-ta', '2000s hit songs'], ['2010-ta', '2010s hit songs'], ['2020-a', 'top hits 2024 2025'],
].map(([l, q]) => ({ key: `d:${l}`, title: l, sub: 'Desetletja', q: [q] }));
const SI_MIXES = [
  ['Slovenski pop', 'slovenski pop hiti'], ['Slovenski rock', 'slovenski rock hiti'], ['Slovenski rap', 'slovenski hip hop rap'],
  ['Ansambli', 'slovenski ansambli narodnozabavna'], ['Slovenske balade', 'slovenske ljubezenske pesmi'], ['Slovenski party', 'slovenske zabavne pesmi'],
].map(([l, q]) => ({ key: `si:${l}`, title: l, sub: 'Slovenska glasba', region: 'si', q: [q] }));
const SI_MIX_ARTISTS = [
  ...RADIO_FOLK_ARTISTS,
  ...RADIO_POP_ARTISTS,
  'siddharta', 'big foot mama', 'mi2', 'dan d', 'zmelkoow', 'joker out', 'mrfy',
  'vlado kreslin', 'magnifico', 'andrej šifrer', 'neisha', 'tinkara kovač',
  'anika horvat', 'žan serčič', 'challe salle', 'nipke', 'zlatko', 'trkaj',
  'emkej', 'klemen klemen', 'slon in sadež', 'naykex', 'xxxtraktor', 'blak',
  'rok n band', "rok'n'band", 'hazard', 'pepel in kri', 'agropop',
  'čudežna polja', 'bepop', 'game over', 'vili resnik', 'helena blagne',
  'neca falk', 'turbo angels', 'black&white', 'milan jesih', 'jani golob',
  'edvin fliser', 'marta zore', 'društvo mrtvih pesnikov', 'da phenomena',
  'california', 'šank rock', 'zablujena generacija', 'nude', 'werner', 'babilon',
  'firbci', 'ansambel vihar', 'ansambel vikend', 'ansambel spev',
  'gavi', 'naveza', 'slovenski oktet', 'ansambel bratov poljanšek',
  'ansambel franca miheliča', 'ansambel petra finka',
  'rock partyzani', 'brendi', 'boris kopitar', 'gregor ravnik', 'perpetuum jazzile',
  'ansambel bratov avsenik', 'ansambel lojzeta slaka', 'ansambel mladi dolenjci',
  'štirje kovači', 'ansambel dobri znanci', 'ptujskih 5', 'polkaholiki',
  'veseli begunjčani', 'ansambel nemir', 'ansambel banovšek', 'ansambel unikat',
];
function mixRegion(m) {
  return m.region || (m.key === 'si' || m.key === 'folk' || m.key.startsWith('si:') ? 'si' : null);
}
function mixSearchQueries(m) {
  const region = mixRegion(m);
  return [...new Set((m.q || []).flatMap((q) => [
    q,
    region === 'si' ? `${q} slovenski izvajalci` : region === 'yu' ? q : `${q} playlist`,
  ]))];
}
function filterMixTracks(m, tracks) {
  const region = mixRegion(m);
  if (region !== 'si') return tracks;
  return tracks.filter((track) => {
    const artist = radioText((track.artist || '').split('•')[0]);
    return SI_MIX_ARTISTS.some((name) => artist.includes(radioText(name)));
  });
}
const ACTIVITIES = [
  ['Kuhanje', 'cooking background music'], ['Večerja', 'dinner jazz music'], ['Pot v službo', 'commute upbeat songs'], ['Branje', 'calm reading music'],
  ['Tek', 'running songs'], ['Dež', 'rainy day music'], ['Poletje', 'summer hit songs'], ['Božič', 'christmas songs'],
].map(([l, q]) => ({ key: `ac:${l}`, title: l, sub: 'Za vsak trenutek', q: [q] }));
const mixGradient = (s) => {
  let x = 0;
  for (const c of s) x = (x * 31 + c.charCodeAt(0)) % 360;
  return `linear-gradient(135deg,hsl(${x},70%,45%),hsl(${(x + 50) % 360},70%,22%))`;
};
const shuffled = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

function myMixTracks() {
  const seen = new Set();
  return shuffled([...db.liked, ...db.history, ...db.library]).filter((t) => (seen.has(t.id) ? false : seen.add(t.id))).slice(0, 40);
}
function topArtists(n) {
  const c = {};
  for (const t of [...db.liked, ...db.history]) if (t.type === 'yt' && t.artist) c[t.artist] = (c[t.artist] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n).map((e) => e[0]);
}
async function fetchMix(m) {
  if (mixCache[m.key]) return mixCache[m.key];
  if (!navigator.onLine) throw new Error('Brez povezave.');
  const tracks = (await Promise.all(mixSearchQueries(m).map((q) => ytSearch(q, 25, true)))).flat();
  const seen = new Set();
  const res = (mixCache[m.key] = shuffled(filterMixTracks(m, tracks)).filter((t) => (seen.has(t.id) ? false : seen.add(t.id))).slice(0, 80));
  setMixCovers(m, res);
  return res;
}
function openMix(m) { view = 'mix'; viewArg = m; renderAll(); }

// Mix covers are stored so the collage shows instantly without extra API calls.
function setMixCovers(m, tracks) {
  const covers = tracks.map((t) => t.cover).filter(Boolean).slice(0, 4);
  if (!covers.length) return;
  db.mixCovers = db.mixCovers || {};
  if (JSON.stringify(db.mixCovers[m.key]) === JSON.stringify(covers)) return;
  db.mixCovers[m.key] = covers;
  save();
}
function mixCoverEl(m) {
  const covers = m.local ? [...db.liked, ...db.history, ...db.library].map((t) => t.cover).filter(Boolean).slice(0, 4) : (db.mixCovers || {})[m.key] || [];
  if (covers.length) return collageEl(covers, 'mixcover');
  return h('div', { class: 'mixcover', style: `background:${mixGradient(m.title)}` }, h('span', {}, m.title));
}
let prefetching = false;
async function prefetchMixCovers(list) {
  if (prefetching || !navigator.onLine) return;
  prefetching = true;
  try {
    for (const m of list.filter((x) => !x.local && !(db.mixCovers || {})[x.key]).slice(0, 14)) {
      if (!['home', 'radio'].includes(view)) break;
      try { setMixCovers(m, await fetchMix(m)); } catch { break; }
      const old = document.querySelector(`[data-mix="${CSS.escape(m.key)}"] .mixcover`);
      if (old) old.replaceWith(mixCoverEl(m));
    }
  } finally { prefetching = false; }
}
const mixCard = (m) => h('div', { class: 'card mix', 'data-mix': m.key, onclick: () => openMix(m) },
  mixCoverEl(m),
  h('button', { class: 'playfab' }, '▶'),
  h('div', { class: 'ct' }, m.title), h('div', { class: 'ca' }, m.sub));

function playRadioStation(station) {
  playTrack({
    id: `radio:${station.id}`,
    type: 'radio',
    title: station.name,
    artist: `V ŽIVO · ${station.freq}`,
    stream: station.stream,
    streams: station.streams,
    station,
  }, { queue: [] }).then((ok) => { if (ok && view === 'stations') render(); });
}

function radioStationMark(station, player = false) {
  const mark = h(player ? 'div' : 'span', {
    class: player ? 'station-player-mark' : 'station-mark',
    style: `--station-color:${station?.color || '#1ed760'}`,
  }, h('span', { class: `station-eq${player ? ' live' : ''}` },
    ...[0, 1, 2, 3, 4].map((i) => h('i', { style: `--i:${i}` }))));
  if (!station?.logo) {
    mark.classList.add('no-logo');
    return mark;
  }
  const logo = h('img', { src: radioStationLogoUrl(station), alt: '', loading: 'lazy' });
  logo.addEventListener('error', () => { logo.remove(); mark.classList.add('no-logo'); });
  mark.prepend(logo);
  return mark;
}

function radioStationLogoUrl(station) {
  return station?.logo ? `img/radio/${station.logo}.png` : '';
}

function radioStationCards() {
  const query = stationQuery.trim().toLocaleLowerCase('sl');
  const stations = SI_RADIO_STATIONS.filter((station) =>
    (stationCategory === 'Vse' || station.group === stationCategory || station.bands.includes(stationCategory))
    && (!query || `${station.name} ${station.style} ${station.freq} ${station.bands.join(' ')}`.toLocaleLowerCase('sl').includes(query)));
  if (!stations.length) return [h('div', { class: 'station-empty' }, 'Za ta filter ni radijskih postaj.')];
  return stations.map((station) => {
    const active = cur?.type === 'radio' && cur.station?.id === station.id;
    const playing = active && isPlaying();
    const playIcon = h('span', { class: `station-play${playing ? ' playing' : ''}` });
    playIcon.innerHTML = playing ? ICON.pause : ICON.play;
    return h('button', {
      class: `station-card${active ? ' active' : ''}`,
      onclick: () => playRadioStation(station),
      'aria-label': `${playing ? 'Predvajano' : 'Predvajaj'}: ${station.name}`,
    },
    radioStationMark(station),
    h('span', { class: 'station-info' },
      h('b', {}, station.name),
      h('small', {}, station.style),
      h('span', { class: 'station-meta' }, station.freq, ' · ', station.bands.join(' / '))),
    playIcon);
  });
}

const views = {
  radio() {
    const mixes = [...SPECIAL_MIXES, ...MOODS.map(moodMix)];
    const groups = [
      ['Začni z radijsko postajo', mixes], ['Slovenska glasba', SI_MIXES], ['Glasbeni slogi', GENRES],
      ['Desetletja', DECADES], ['Za vsak trenutek', ACTIVITIES],
    ];
    setTimeout(() => prefetchMixCovers(groups.flatMap((g) => g[1])), 300);
    return [
      hero(h('h2', {}, 'Radio'), h('div', { class: 'note', style: 'margin:0' }, 'Izberi razpoloženje ali glasbeni slog.')),
      h('div', { class: 'chips' }, mixes.map((m) => h('button', { class: 'chip', onclick: () => openMix(m) }, m.title))),
      ...groups.flatMap(([title, list]) => [h('h3', {}, title), h('div', { class: 'grid' }, list.map(mixCard))]),
    ];
  },
  stations() {
    const current = cur?.type === 'radio' ? cur : null;
    const categories = ['Vse', 'FM', 'DAB', ...new Set(SI_RADIO_STATIONS.map((station) => station.group))];
    const search = h('input', {
      class: 'station-search',
      type: 'search',
      placeholder: 'Poišči postajo ali zvrst …',
      value: stationQuery,
      'aria-label': 'Poišči slovensko radijsko postajo',
      oninput: (event) => {
        stationQuery = event.target.value;
        stationGrid.replaceChildren(...radioStationCards());
      },
    });
    const stationGrid = h('div', { class: 'station-grid' }, radioStationCards());
    const mainPlay = h('button', {
      class: 'station-main-play',
      disabled: !current,
      title: current ? (isPlaying() ? 'Ustavi radio' : 'Nadaljuj radio') : 'Najprej izberi postajo',
      onclick: () => togglePlay(),
    });
    mainPlay.innerHTML = isPlaying() && current ? ICON.pause : ICON.play;
    return [
      h('section', { class: 'station-hero' },
        h('div', { class: 'station-kicker' }, h('span', { class: 'station-live-dot' }), ' SLOVENIJA · RADIO V ŽIVO'),
        h('div', { class: 'station-hero-copy' },
          h('div', {},
            h('h2', {}, 'Slovenski radio'),
            h('p', {}, 'FM in DAB postaje, ki jih lahko poslušaš prek spletnega toka.')),
          h('div', { class: 'station-count' }, h('b', {}, String(SI_RADIO_STATIONS.length)), h('span', {}, 'postaj')))),
      h('section', { class: 'station-player' },
        radioStationMark(current?.station, true),
        h('div', { class: 'station-player-info' },
          h('span', { class: 'station-player-label' }, current ? 'ZDAJ V ŽIVO' : 'PRIPRAVLJENO ZA POSLUŠANJE'),
          h('b', {}, current?.title || 'Izberi svojo postajo'),
          h('small', {}, current?.artist || 'Slovenski radio, vedno pri roki')),
        mainPlay),
      h('div', { class: 'station-toolbar' },
        h('div', { class: 'station-filters' }, categories.map((category) => h('button', {
          class: `station-filter${stationCategory === category ? ' active' : ''}`,
          onclick: () => { stationCategory = category; render(); },
        }, category))),
        search),
      h('div', { class: 'station-grid-wrap' }, stationGrid),
      h('a', {
        class: 'station-credit',
        href: 'https://siradio.si/',
        target: '_blank',
        rel: 'noreferrer',
      }, 'Tokovi in frekvence: SIradio.si'),
      h('a', {
        class: 'station-credit',
        href: 'https://dab.si/programi',
        target: '_blank',
        rel: 'noreferrer',
      }, 'Celoten seznam DAB-programov: dab.si'),
      h('p', { class: 'station-availability' }, 'Aplikacija predvaja spletne tokove; za sprejem FM/DAB-signala brez interneta je potreben radijski sprejemnik.'),
    ];
  },
  mix() {
    const m = viewArg;
    const body = h('div', {});
    const show = (tracks) => {
      body.replaceChildren(
        h('div', { class: 'toolbar' },
          btn('▶ Predvajaj', () => tracks.length && playFrom(tracks, tracks[0]), 'btn'),
          btn('Premešaj', () => { const s = shuffled(tracks);           if (s.length) playFrom(s, s[0]); }, 'btn sec'),
          btn('Osveži', () => { delete mixCache[m.key]; if (m.local) show(m.local()); else load(); }, 'btn sec'),
          m.key === 'my' || (db.savedMixes || []).some((s) => s.key === m.key)
            ? null
            : btn('Shrani na profil', () => { db.savedMixes = [...(db.savedMixes || []), { key: m.key, title: m.title, sub: m.sub, q: m.q, region: m.region }]; save(); toast('Miks shranjen na tvoj profil.'); show(tracks); }, 'btn sec')),
        ...trackRows(tracks, 'Ni skladb.'));
    };
    const load = () => {
      body.replaceChildren(h('div', { class: 'note' }, 'Nalagam miks…'));
      fetchMix(m).then((t) => { if (view === 'mix' && viewArg === m) show(t); }).catch((e) => {
        if (view !== 'mix' || viewArg !== m) return;
        body.replaceChildren(h('div', { class: 'note' }, e.message));
      });
    };
    if (m.local) show(m.local()); else load();
    return [hero(h('h2', {}, m.title), h('div', { class: 'note' }, m.sub)), body];
  },
  home() {
    const tiles = [
      { label: 'Všečkane skladbe', icon: '♥', bg: 'linear-gradient(135deg,#450af5,#c4efd9)', v: 'liked' },
      { label: 'Offline knjižnica', icon: '⬇', bg: 'linear-gradient(135deg,#1ed760,#0a5c2a)', v: 'library' },
      ...db.playlists.slice(0, 6).map((p) => ({ label: p.name, icon: '♪', bg: '#3a3a3a', v: 'playlists', arg: p.id })),
    ];
    const hours = new Date().getHours();
    const homeMixes = [
      ...SPECIAL_MIXES,
      ...topArtists(4).map((a) => ({ key: `a:${a}`, title: `Miks: ${a}`, sub: 'Podobna glasba', q: [a], artist: a })),
      ...MOODS.slice(0, 4).map(moodMix),
    ];
    setTimeout(() => prefetchMixCovers(homeMixes), 300);
    const greet = hours < 12 ? 'Dobro jutro' : hours < 18 ? 'Dober dan' : 'Dober večer';
    return [
      hero(h('h2', {}, `${greet}, ${account.name}`),
        h('div', { class: 'tiles' }, tiles.map((t) => h('button', { class: 'tile', onclick: () => { view = t.v; viewArg = t.arg || null; renderAll(); } },
          h('span', { class: 'ico', style: `background:${t.bg}` }, t.icon), t.label)))),
      h('div', { class: 'chips' }, [...SPECIAL_MIXES, ...MOODS.map(moodMix)].map((m) => h('button', { class: 'chip', onclick: () => openMix(m) }, m.title))),
      h('h3', {}, 'Tvoji miksi'),
      h('div', { class: 'grid' }, [
        { key: 'my', title: 'Moj miks', sub: 'Iz tvojih všečkov in zgodovine', local: myMixTracks },
        ...homeMixes,
      ].map(mixCard)),
      ...section('Nazadnje predvajano', db.history.slice(0, 12), 'Še nič predvajanega. Poišči skladbo ali dodaj svojo glasbo.'),
      ...section('Tvoja offline glasba', db.library.slice(-12).reverse(), 'Dodaj datoteke v Offline knjižnici.'),
      ...section('Všečkane', db.liked.slice(0, 12), 'Še nimaš všečkanih skladb.'),
    ];
  },
  search() {
    const q = searchState.q.toLowerCase();
    const local = q ? db.library.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(q)) : [];
    return [
      hero(h('h2', {}, searchState.q ? `Rezultati: ${searchState.q}` : 'Iskanje')),
      !searchState.q && h('div', { class: 'note' }, 'Vpiši iskalni niz zgoraj in pritisni Enter.'),
      searchState.error && h('div', { class: 'note' }, searchState.error),
      local.length ? h('h3', {}, 'V knjižnici') : null, ...local.map((t) => trackRow(t, local)),
      searchState.results ? [h('h3', {}, 'YouTube'), ...trackRows(searchState.results, 'Ni rezultatov.')] : null,
    ];
  },
  library() {
    return [
      hero(h('h2', {}, 'Offline knjižnica')),
      h('div', { class: 'note' }, 'Skladbe, ki jih dodaš, se shranijo v zasebni offline predpomnilnik in delujejo brez signala. Dodajaj samo glasbo, ki je tvoja ali imaš dovoljenje za uporabo.'),
      h('div', { class: 'toolbar' }, btn('⬇ Prenesi / dodaj datoteke', async () => {
        const added = await window.gmajna.importFiles();
        db.library.push(...added);
        save();
        toast(`Dodanih skladb: ${added.length}`);
        renderAll();
      }, 'btn'),
      btn('🔒 Uvozi šifrirano · Premium', async () => {
        if (!billingStatus.isPremium) {
          view = 'profile';
          renderAll();
          toast('Za šifriran uvoz potrebuješ aktivno Premium naročnino.');
          return;
        }
        try {
          const added = await window.gmajna.importEncryptedFiles({
            token: account.token,
            accountId: account.id,
          });
          db.library.push(...added);
          save();
          toast(`Šifrirano dodanih skladb: ${added.length}`);
          renderAll();
        } catch (e) {
          toast(e.message || 'Šifriran uvoz ni uspel.');
        }
      }, 'btn sec')),
      ...trackRows(db.library, 'Knjižnica je prazna.', (t) => btn('Odstrani', async () => {
        await removeLocal(t);
        renderAll();
      })),
    ];
  },
  liked() {
    return [hero(h('h2', {}, 'Všečkane skladbe')), ...trackRows(db.liked, 'Še nimaš všečkanih skladb.')];
  },
  history() {
    return [hero(h('h2', {}, 'Zgodovina')), ...trackRows(db.history, 'Zgodovina je prazna.')];
  },
  queue() {
    return [
      hero(h('h2', {}, 'Čakalna vrsta')),
      h('div', { class: 'toolbar' }, btn('Počisti', () => { queue = cur ? [cur] : []; qIndex = cur ? 0 : -1; render(); }, 'btn sec')),
      ...trackRows(queue, 'Vrsta je prazna.', (t) => btn('Odstrani', () => {
        queue = queue.filter((x) => x !== t);
        qIndex = cur ? queue.findIndex((x) => x.id === cur.id) : -1;
        render();
      })),
    ];
  },
  playlists() {
    const pl = db.playlists.find((p) => p.id === viewArg);
    if (!pl) {
      return [
        hero(h('h2', {}, 'Seznami predvajanja')),
        h('div', { class: 'toolbar' }, btn('+ Nov seznam', newPlaylist, 'btn')),
        db.playlists.length ? h('div', { class: 'grid' }, db.playlists.map((p) => h('div', { class: 'card', onclick: () => { viewArg = p.id; renderAll(); } },
          playlistIcon(p),
          h('div', { class: 'ct' }, p.name), h('div', { class: 'ca' }, `${p.tracks.length} skladb`)))) : h('div', { class: 'note' }, 'Še nimaš seznamov.'),
      ];
    }
    const icon = playlistIcon(pl);
    icon.classList.add('pl-icon');
    return [
      hero(h('div', { class: 'pl-head' }, icon,
        h('div', {}, h('small', {}, 'SEZNAM'), h('h2', {}, pl.name),
          h('div', { class: 'note', style: 'margin:0' }, `${pl.tracks.length} skladb` + (pl.collabId ? ` · Skupen: ${(pl.members || []).map((m) => m.name).join(', ')}` : '')),
          pl.source === 'spotify' ? h('div', { class: 'note', style: 'margin:4px 0 0' }, 'Uvožena kopija seznama. Spremembe se ne zapisujejo nazaj v Spotify.') : null))),
      h('div', { class: 'toolbar' },
        btn('▶ Predvajaj', () => pl.tracks.length && playFrom(pl.tracks, pl.tracks[0]), 'btn'),
        btn('+ Dodaj skladbo', () => addTrackFromSearch(pl), 'btn sec'),
        btn('Preimenuj', async () => { const n = await ask('Novo ime', pl.name); if (n) { pl.name = n; save(); renderAll(); } }, 'btn sec'),
        btn('Spremeni ikono', () => changePlaylistIcon(pl), 'btn sec'),
        cloudOn() ? (pl.collabId ? btn('Povabi prijatelja', () => inviteToPlaylist(pl), 'btn sec') : btn('Naredi skupen', () => makeShared(pl), 'btn sec')) : null,
        btn('Izbriši seznam', async () => {
          if (!(await confirmBox('Izbriši seznam', `Izbrišem "${pl.name}"?`))) return;
          if (pl.collabId) await cloud('DELETE', `/api/collabs/${pl.collabId}`, null, account.token);
          db.playlists = db.playlists.filter((p) => p !== pl); viewArg = null; save(); renderAll();
        }, 'btn sec')),
      ...trackRows(pl.tracks, 'Seznam je prazen.', (t) => btn('Odstrani', async () => {
        if (pl.collabId) { await socialCall('DELETE', `/api/collabs/${pl.collabId}/tracks?trackId=${encodeURIComponent(t.id)}`); return; }
        pl.tracks = pl.tracks.filter((x) => x.id !== t.id); save(); render(); renderSidebar();
      })),
    ];
  },
  users() {
    if (!cloudOn()) return [hero(h('h2', {}, 'Uporabniki')), h('div', { class: 'note' }, 'Za prijatelje se prijavi z računom (ne z lokalnim profilom).')];
    socialRefresh();
    const row = (u, ...actions) => h('div', { class: 'row', style: 'display:flex;align-items:center;gap:12px;padding:8px 12px' },
      userDot(u), h('span', { style: 'flex:1' }, u.name), ...actions);
    const known = new Set([...social.friends, ...social.incoming, ...social.outgoing].map((u) => u.id));
    return [
      hero(h('h2', {}, 'Uporabniki'), h('div', { class: 'note' }, 'Prijatelji in skupni seznami.')),
      h('div', { class: 'toolbar' }, h('input', {
        type: 'text', placeholder: 'Poišči uporabnika po imenu…', value: social.q, style: 'min-width:260px',
        onkeydown: (e) => { if (e.key === 'Enter') searchUsers(e.target.value.trim().toLowerCase()); },
      })),
      social.results.length ? h('h3', {}, 'Rezultati') : null,
      ...social.results.map((u) => row(u, known.has(u.id) ? h('small', {}, 'Že dodan') : btn('Dodaj prijatelja', () => socialCall('POST', '/api/friends', { id: u.id }, 'Prošnja poslana.'), 'btn sec'))),
      social.incoming.length ? h('h3', {}, 'Prošnje zate') : null,
      ...social.incoming.map((u) => row(u, btn('Sprejmi', () => socialCall('POST', '/api/friends/accept', { id: u.id }), 'btn'), btn('Zavrni', () => socialCall('DELETE', '/api/friends/' + u.id), 'btn sec'))),
      h('h3', {}, 'Prijatelji'),
      ...(social.friends.length ? social.friends.map((u) => row(u, btn('Odstrani', async () => { if (await confirmBox('Odstrani prijatelja', `Odstranim ${u.name}?`)) socialCall('DELETE', '/api/friends/' + u.id); }, 'btn sec'))) : [h('div', { class: 'note' }, 'Še nimaš prijateljev. Poišči jih zgoraj.')]),
      social.outgoing.length ? h('h3', {}, 'Poslane prošnje') : null,
      ...social.outgoing.map((u) => row(u, btn('Prekliči', () => socialCall('DELETE', '/api/friends/' + u.id), 'btn sec'))),
      h('h3', {}, 'Skupni seznami'),
      ...(db.playlists.some((p) => p.collabId) ? [h('div', { class: 'grid' }, db.playlists.filter((p) => p.collabId).map((p) => h('div', { class: 'card', onclick: () => { view = 'playlists'; viewArg = p.id; renderAll(); } },
        playlistIcon(p), h('div', { class: 'ct' }, p.name), h('div', { class: 'ca' }, `${p.members?.length || 1} članov · ${p.tracks.length} skladb`))))] : [h('div', { class: 'note' }, 'Odpri svoj seznam in pritisni »Naredi skupen«.')]),
    ];
  },
  jam() {
    const body = jam.room
      ? h('div', { class: 'panel' },
        h('div', {}, jam.isHost ? 'Si gostitelj tega Jama.' : 'Pridružen si Jamu.'),
        h('div', { class: 'note' }, jam.connected ? 'Povezano s strežnikom.' : 'Povezovanje s strežnikom …'),
        h('div', {}, 'Koda sobe: ', h('strong', {}, jam.room), ' ',
          btn('Kopiraj', () => { navigator.clipboard.writeText(jam.room); toast('Koda kopirana.'); }, 'btn sec'),
          btn('Kopiraj povabilno povezavo', async () => {
            try {
              await navigator.clipboard.writeText(`${jam.serverUrl}/j/${encodeURIComponent(jam.room)}`);
              toast('Povabilna povezava kopirana.');
            } catch (e) {
              console.error('Povabilne povezave ni mogoče kopirati:', e);
              toast('Povezave ni mogoče kopirati.');
            }
          }, 'btn sec')),
        h('h3', {}, 'Poslušalci'),
        h('ul', { class: 'members' }, jam.members.map((m) => h('li', {}, m.name + (m.peerId === jam.hostId ? ' (gostitelj)' : '')))),
        jam.isHost && h('label', {}, h('input', { type: 'checkbox', checked: jam.controlAllowed ? 'checked' : null, onchange: (e) => jam.socket.emit('jam:control', { enabled: e.target.checked }) }), ' Dovoli vsem upravljanje'),
        h('div', { class: 'toolbar', style: 'margin-top:16px' },
          jam.isHost && h('button', { class: 'btn sec', disabled: !jam.connected, onclick: inviteJamFriend }, 'Povabi prijatelja'),
          btn(jam.isHost ? 'Končaj Jam' : 'Zapusti Jam', () => jamLeave(false), 'btn danger')))
      : h('div', {},
        h('div', { class: 'note' }, 'Jam omogoča skupno poslušanje v realnem času. Sinhronizirajo se YouTube skladbe; lokalnih datotek ni mogoče deliti.'),
        h('div', { class: 'toolbar' }, btn('Začni Jam', jamHost, 'btn'),
          btn('Pridruži se s kodo', async () => { const code = await ask('Koda sobe'); if (code) jamJoin(code); }, 'btn sec')));
    return [hero(h('h2', {}, 'Jam')), body];
  },
  profile() {
    const colorRow = h('div', { class: 'swatches' }, COLORS.map((c) => h('div', {
      class: 'sw' + (account.color === c ? ' on' : ''), style: `background:${c}`,
      onclick: () => {
        account.color = c; updateAvatar(); flush(); render();
        if (account.token) cloud('PUT', '/api/account', { color: c }, account.token);
      },
    })));
    const prof = db.profile = db.profile || {};
    const picInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
    picInput.addEventListener('change', async () => {
      const res = picInput.files[0] && await imageToDataUrl(picInput.files[0], 700, true);
      if (!res) { toast('Slike ni mogoče naložiti.'); return; }
      prof.avatar = res.url; prof.avatarPos = { x: 50, y: 50, zoom: 1, ratio: res.ratio }; save(); updateAvatar(); renderAll();
      adjustAvatar(prof, () => { save(); updateAvatar(); renderAll(); });
    });
    const av = h('div', { class: 'profile-av', style: prof.avatar ? `background:${avatarBg(prof)}` : `background:${account.color}` }, prof.avatar ? '' : account.name[0].toUpperCase());
    const myMixes = [
      { key: 'my', title: 'Moj miks', sub: 'Iz tvojih všečkov in zgodovine', local: myMixTracks },
      ...topArtists(4).map((a) => ({ key: `a:${a}`, title: `Miks: ${a}`, sub: 'Podobna glasba', q: [a], artist: a })),
      ...(db.savedMixes || []),
    ];
    const totalMin = Math.round(db.history.length * 3.5);
    const billingLabel = billingStatus.status === 'loading' ? 'Preverjam naročnino …'
      : billingStatus.status === 'unavailable' ? 'Stanja naročnine trenutno ni mogoče preveriti.'
        : billingStatus.isPremium
          ? `Premium je aktiven${billingStatus.cancelAtPeriodEnd ? ' in se ob koncu obdobja ne bo podaljšal' : ''}${billingStatus.currentPeriodEnd ? ` do ${new Date(billingStatus.currentPeriodEnd).toLocaleDateString('sl-SI')}` : ''}.`
          : billingStatus.status === 'past_due' ? 'Plačilo naročnine ni uspelo. Posodobi plačilno metodo v Stripe portalu.'
            : 'Brez aktivne Premium naročnine.';
    return [
      h('div', { class: 'hero' }, h('div', { class: 'profile-head' },
        av,
        h('div', {}, h('small', {}, 'PROFIL'), h('h2', {}, account.name),
          prof.status ? h('div', { class: 'note', style: 'margin:0 0 4px' }, `♪ ${prof.status}`) : null,
          prof.bio ? h('div', { class: 'note', style: 'margin:0 0 6px;max-width:560px' }, prof.bio) : null,
          h('div', { class: 'note', style: 'margin:0 0 6px' }, account.email || 'E-pošta ni nastavljena'),
          h('div', { class: 'note', style: 'margin:0' }, `${db.playlists.length} seznamov · ${db.liked.length} všečkanih · ${db.library.length} offline skladb · ${db.history.length} nazadnje predvajanih (~${totalMin} min)`)))),
      h('h3', {}, 'Rythmify Premium'),
      h('div', { class: 'note' }, billingLabel),
      h('div', { class: 'note' }, 'Premium vključuje šifriran offline uvoz lastnih ali licenciranih zvočnih datotek. Plačilo in naročnino varno upravlja Stripe.'),
      h('div', { class: 'toolbar' },
        billingStatus.isPremium
          ? btn('Upravljaj / prekliči naročnino', () => openBillingPage('/api/billing/portal'), 'btn')
          : btn('Kupi Premium', () => openBillingPage('/api/billing/checkout'), 'btn'),
        !billingStatus.isPremium && billingStatus.status !== 'free' && billingStatus.status !== 'loading' && billingStatus.status !== 'unavailable'
          ? btn('Upravljaj naročnino', () => openBillingPage('/api/billing/portal'), 'btn sec') : null,
        btn('Osveži stanje', async () => {
          try { await refreshBillingStatus(); render(); }
          catch (e) { toast(e.message || 'Stanja naročnine ni mogoče osvežiti.'); }
        }, 'btn sec')),
      h('div', { class: 'toolbar' }, picInput,
        btn('Spremeni sliko', () => picInput.click(), 'btn sec'),
        prof.avatar ? btn('Nastavi položaj', () => adjustAvatar(prof, () => { save(); updateAvatar(); renderAll(); }), 'btn sec') : null,
        btn('Odstrani sliko', () => { delete prof.avatar; save(); updateAvatar(); renderAll(); }, 'btn sec'),
        btn('Opis', async () => { const v = await ask('Opis profila', prof.bio || ''); if (v === null || v === undefined) return; prof.bio = v.trim().slice(0, 200); save(); render(); }, 'btn sec'),
        btn('Stanje', async () => { const v = await ask('Kaj trenutno poslušaš / razpoloženje', prof.status || ''); if (v === null || v === undefined) return; prof.status = v.trim().slice(0, 60); save(); render(); }, 'btn sec')),
      h('h3', {}, 'Tvoji miksi'),
      h('div', { class: 'grid' }, myMixes.map((m) => {
        const c = mixCard(m);
        if ((db.savedMixes || []).some((s) => s.key === m.key)) {
          c.append(h('button', { class: 'btn sec', style: 'margin-top:6px;font-size:11px', onclick: (e) => { e.stopPropagation(); db.savedMixes = db.savedMixes.filter((s) => s.key !== m.key); save(); render(); } }, 'Odstrani'));
        }
        return c;
      })),
      db.playlists.length ? h('h3', {}, 'Tvoji seznami') : null,
      db.playlists.length ? h('div', { class: 'grid' }, db.playlists.map((p) => h('div', { class: 'card', onclick: () => { view = 'playlists'; viewArg = p.id; renderAll(); } },
        playlistIcon(p), h('div', { class: 'ct' }, p.name), h('div', { class: 'ca' }, `${p.tracks.length} skladb`)))) : null,
      h('h3', {}, 'Barva profila'), colorRow,
      h('h3', {}, 'Račun'),
      h('div', { class: 'toolbar' },
        btn('Spremeni ime', async () => {
          const n = await ask('Novo uporabniško ime', account.name);
          if (!n || n.length < 2) return;
          if (root.accounts.some((a) => a !== account && a.name.toLowerCase() === n.toLowerCase())) { toast('To ime je že zasedeno.'); return; }
          if (account.token) {
            const r = await cloud('PUT', '/api/account', { name: n }, account.token);
            if (r.status === 409) { toast(r.json.error); return; }
          }
          account.name = n; updateAvatar(); flush(); renderAll();
        }, 'btn sec'),
        btn('Spremeni e-pošto', async () => {
          const m = (await ask('Nova e-pošta', account.email || ''))?.toLowerCase();
          if (!m) return;
          if (!EMAIL_RE.test(m)) { toast('Neveljaven e-poštni naslov.'); return; }
          if (root.accounts.some((a) => a !== account && (a.email || '') === m)) { toast('Ta e-pošta je že registrirana.'); return; }
          if (account.token) {
            const r = await cloud('PUT', '/api/account', { email: m }, account.token);
            if (r.status === 409 || r.status === 400) { toast(r.json.error); return; }
          }
          account.email = m; flush(); renderAll();
        }, 'btn sec'),
        btn('Spremeni geslo', async () => {
          const pw = await ask('Novo geslo (vsaj 6 znakov)', '', 'password');
          if (!pw || pw.length < 6) { if (pw) toast('Geslo je prekratko.'); return; }
          const salt = newSalt(); const hash = await hashPw(pw, salt);
          if (account.token) {
            const r = await cloud('PUT', '/api/account', { salt, hash }, account.token);
            if (!r.ok) { toast('Gesla trenutno ni mogoče spremeniti (ni povezave s strežnikom).'); return; }
          }
          account.salt = salt; account.hash = hash; flush(); toast('Geslo spremenjeno.');
        }, 'btn sec'),
        btn('Odjava', logout, 'btn'),
        btn('Izbriši profil', async () => {
          if (!(await confirmBox('Izbriši profil', 'Profil, seznami in offline skladbe tega profila bodo trajno izbrisani.'))) return;
          if (account.token) {
            const r = await cloud('DELETE', '/api/account', null, account.token);
            if (!r.ok) { toast(accountApiError(r, 'Brisanje profila')); return; }
          }
          for (const t of db.library) await window.gmajna.removeFile(t.file);
          root.accounts = root.accounts.filter((a) => a !== account);
          account.data = null; account = null;
          await logoutAfterDelete();
        }, 'btn danger')),
    ];
  },
  visualizer() {
    const s = db.settings;
    const modes = [['bars', 'Stolpci'], ['wave', 'Valovanje'], ['circle', 'Krog'], ['mirror', 'Zrcalo'], ['dots', 'Delci']];
    const colorModes = [['theme', 'Tema'], ['rainbow', 'Mavrica'], ['electric', 'Električno']];
    const set = (key, value, refresh = false) => {
      s[key] = value;
      save();
      if (refresh) render();
    };
    const range = (label, key, min, max, suffix = '') => {
      const displayValue = (value) => `${key === 'vizSmoothing' ? Math.round(value * 100) : value}${suffix}`;
      const value = h('span', { class: 'viz-setting-value' }, displayValue(s[key]));
      return h('label', { class: 'viz-setting' },
        h('span', {}, label),
        h('input', {
          type: 'range', min, max, step: key === 'vizSmoothing' ? '0.01' : '1', value: s[key],
          oninput: (event) => {
            const next = Number(event.target.value);
            set(key, next);
            value.textContent = displayValue(next);
          },
        }),
        value);
    };
    const control = (icon, title, onclick, disabled = false, on = false) => {
      const button = h('button', { class: `viz-control${on ? ' on' : ''}`, title, onclick, disabled });
      button.innerHTML = icon;
      return button;
    };
    return [
      hero(h('h2', {}, 'Vizualizator'), h('div', { class: 'note', style: 'margin:0' }, cur ? `${cur.title} · ${cur.artist}` : 'Predvajaj skladbo.')),
      h('section', { class: 'viz-panel' },
        h('div', { class: 'viz-section-head' }, h('h3', {}, 'Način prikaza'), h('span', {}, 'Izberi odziv na zvok')),
        h('div', { class: 'viz-mode-picker' }, modes.map(([key, label]) =>
          btn(label, () => set('viz', key, true), s.viz === key ? 'btn' : 'btn sec'))),
        h('canvas', { id: 'viz-canvas', style: `--viz-height:${s.vizHeight}vh` }),
        h('div', { class: 'viz-controls', 'aria-label': 'Kontrole predvajanja' },
          control(ICON.prev, 'Prejšnja', prev, !cur),
          control(isPlaying() ? ICON.pause : ICON.play, isPlaying() ? 'Pavza' : 'Predvajaj', () => { togglePlay(); render(); }, !cur),
          control(ICON.next, 'Naslednja', () => next(false), !cur),
          control(ICON.shuffle, 'Naključno', () => { $('#btn-shuffle').click(); render(); }, false, shuffle),
          control(ICON.repeat, 'Ponovi', () => { $('#btn-repeat').click(); render(); }, false, repeat !== 'off')),
        h('div', { class: 'viz-options' },
          h('div', { class: 'viz-option-group' },
            h('b', {}, 'Videz'),
            h('div', { class: 'viz-color-picker' }, colorModes.map(([key, label]) =>
              btn(label, () => set('vizColor', key, true), s.vizColor === key ? 'btn' : 'btn sec'))),
            h('label', { class: 'viz-toggle' },
              h('input', { type: 'checkbox', checked: s.vizGlow ? 'checked' : null, onchange: (event) => set('vizGlow', event.target.checked) }),
              h('span', {}, 'Sijaj'))),
          h('div', { class: 'viz-option-group' },
            h('b', {}, 'Odzivnost'),
            range('Višina prikaza', 'vizHeight', 30, 70, ' vh'),
            range('Glajenje zvoka', 'vizSmoothing', 0, 0.95, '%'))),
        h('p', { class: 'viz-help' }, 'Za lokalne skladbe se uporablja dejanski zvok. Pri YouTube predvajanju aplikacija prikaže animiran približek.')),
    ];
  },
  settings() {
    const s = db.settings;
    const text = (label, key, type = 'text') => h('div', { class: 'setting' }, h('label', {}, label),
      h('input', { type, value: s[key], onchange: (e) => { s[key] = e.target.value.trim(); save(); } }));
    const range = (label, get, set, min, max) => h('div', { class: 'setting' }, h('label', {}, label),
      h('input', { type: 'range', min, max, value: get(), onchange: (e) => { set(Number(e.target.value)); save(); } }));
    return [
      hero(h('h2', {}, 'Nastavitve')),
      h('div', { class: 'setting' }, h('label', {}, 'Jezik / Language'),
        h('select', { onchange: (e) => window.setLang(e.target.value) },
          [['sl', 'Slovenščina'], ['en', 'English']].map(([v, n]) => h('option', { value: v, selected: window.getLang() === v ? 'selected' : null }, n)))),
      h('h3', {}, 'Posodobitve'),
      (() => {
        const status = h('span', {}, '');
        window.gmajna.getVersion().then((v) => { status.textContent = `Nameščena različica: ${v}`; });
        return h('div', { class: 'setting' }, h('label', {}, 'Rythmify'), status,
          btn('Preveri posodobitve', async () => {
            status.textContent = 'Preverjam …';
            const r = await window.gmajna.checkUpdate();
            status.textContent = r.status === 'latest' ? `Različica ${r.current} je najnovejša ✓`
              : r.status === 'available' ? `Na voljo ${r.latest}; prenaša se, ob koncu te vprašam za ponovni zagon.`
                : r.status === 'dev' ? `Razvojna različica ${r.current}` : `Napaka pri preverjanju: ${r.error}`;
          }, 'btn sec'));
      })(),
      h('h3', {}, 'Discord'),
      h('div', { class: 'setting' }, h('label', {}, 'Prikaži, kaj poslušam, na Discordu'),
        h('input', { type: 'checkbox', checked: s.discord !== false ? 'checked' : null, onchange: (e) => { s.discord = e.target.checked; save(); } })),
      h('h3', {}, 'Spotify'),
      h('div', { class: 'setting' }, h('label', {}, 'Spotify (uvoz seznamov)'),
        h('span', {}, spAuth?.access ? 'Povezan ✓ ' : 'Ni povezan '),
        spAuth?.access ? [btn('Uvozi seznam', spImport, 'btn sec'), btn('Odklopi', spDisconnect, 'btn sec')] : btn('Poveži Spotify', spConnect, 'btn sec')),
      h('h3', {}, 'Videz in zvok'),
      h('div', { class: 'setting' }, h('label', {}, 'Tema'),
        h('select', { onchange: (e) => { s.theme = e.target.value; s.ambientCustom = ''; save(); applyTheme(); } },
          Object.keys(THEME_COLORS).map((t) => h('option', { value: t, selected: s.theme === t ? 'selected' : null }, THEME_NAMES[t])))),
      range('Zatemnitev med skladbami (s)', () => s.fade, (v) => { s.fade = v; }, 0, 12),
      h('div', { class: 'note' }, 'Izenačevalnik in vizualizator v živo delujeta za offline skladbe (YouTube predvajalnika ni mogoče obdelovati). Zatemnitev deluje povsod.'),
      range('Bas (dB)', () => s.eq.bass, (v) => { s.eq.bass = v; applyEq(); }, -12, 12),
      range('Srednji toni (dB)', () => s.eq.mid, (v) => { s.eq.mid = v; applyEq(); }, -12, 12),
      range('Visoki toni (dB)', () => s.eq.treble, (v) => { s.eq.treble = v; applyEq(); }, -12, 12),
    ];
  },
};

async function removeLocal(t) {
  await window.gmajna.removeFile(t.file);
  db.library = db.library.filter((x) => x.id !== t.id);
  db.liked = db.liked.filter((x) => x.id !== t.id);
  db.history = db.history.filter((x) => x.id !== t.id);
  db.playlists.forEach((p) => { p.tracks = p.tracks.filter((x) => x.id !== t.id); });
  queue = queue.filter((x) => x.id !== t.id);
  qIndex = cur ? queue.findIndex((x) => x.id === cur.id) : -1;
  save();
}

async function logoutAfterDelete() {
  jamLeave(true);
  stopEngines();
  cur = null; queue = []; qIndex = -1;
  root.session = '';
  db = defaultDb();
  updateNow();
  await window.gmajna.setStore(root);
  showAuth();
}

function renderSidebar() {
  const nav = (v, icon, bg, title, sub, arg) => h('button', {
    class: 'nav' + (view === v && (viewArg || null) === (arg || null) ? ' active' : ''),
    title,
    onclick: () => { view = v; viewArg = arg || null; renderAll(); },
  }, h('span', { class: 'ico', style: `background:${bg}` }, icon), h('span', {}, h('b', {}, title), h('small', {}, sub)));
  const makeNav = (v, icon, bg, title, sub, arg) => {
    const button = nav(v, icon, bg, title, sub, arg);
    const iconEl = button.querySelector('.ico');
    if (icon) iconEl.innerHTML = icon;
    return button;
  };
  const stationNav = makeNav('stations', ICON.radio, 'linear-gradient(135deg,#124f39,#18384e)', 'Slovenske postaje', 'Radio v živo');
  if (cur?.type === 'radio') {
    stationNav.querySelector('.ico').replaceChildren(radioStationMark(cur.station));
  }
  $('#sidebar').replaceChildren(
    h('div', { class: 'side-head' }, h('span', {}, 'Meni')),
    makeNav('home', ICON.home, 'transparent', 'Domov', 'Priporočeno'),
    nav('radio', '◉', 'transparent', 'Radio', 'Razpoloženjski miksi'),
    stationNav,
    h('div', { class: 'side-head' }, h('span', {}, 'Tvoja knjižnica')),
    nav('liked', '♥', 'linear-gradient(135deg,#450af5,#c4efd9)', 'Všečkane skladbe', `${db.liked.length} skladb`),
    nav('library', '⬇', 'linear-gradient(135deg,#1ed760,#0a5c2a)', 'Offline knjižnica', `${db.library.length} skladb`),
    h('div', { class: 'side-head' }, h('span', {}, 'Seznami'), h('button', { title: 'Nov seznam', onclick: newPlaylist }, '+')),
    ...db.playlists.map((p) => {
      const b = nav('playlists', '', '#3a3a3a', p.name, `Seznam · ${p.tracks.length}`, p.id);
      const icon = playlistIcon(p);
      icon.style.cssText += ';width:100%;height:100%;border-radius:4px;object-fit:cover;font-size:12px';
      b.querySelector('.ico').replaceChildren(icon);
      return b;
    }),
    h('div', { class: 'side-head' }, h('span', {}, 'Predvajanje')),
    nav('queue', '☰', '#333', 'Čakalna vrsta', `${queue.length} skladb`),
    nav('history', '↺', '#333', 'Zgodovina', 'Nazadnje predvajano'),
    makeNav('visualizer', ICON.viz, 'linear-gradient(135deg,#155c3a,#202d46)', 'Vizualizator', 'Zvok v živo'),
    h('div', { class: 'side-head' }, h('span', {}, 'Orodja')),
    nav('users', '☺', '#333', 'Uporabniki', `${social.friends.length} prijateljev`),
    nav('jam', '◎', '#333', 'Jam', jam.room ? 'Aktiven' : 'Skupno poslušanje'),
    nav('settings', '⚙', '#333', 'Nastavitve', 'Strežnik, YouTube, Spotify, videz'),
    h('div', { id: 'net' }, navigator.onLine ? '● Povezano' : '○ Brez povezave: samo offline skladbe'),
    h('div', { id: 'appver', style: 'font-size:11px;opacity:.5;padding:2px 12px 6px' }, appVersion ? `v${appVersion}` : ''));
}

function render() {
  if (!account) return;
  const content = $('#content');
  content.replaceChildren(...[views[view]()].flat(3).filter(Boolean));
  if (view === 'visualizer' && !vizRaf) vizRaf = requestAnimationFrame(vizLoop);
}
function renderAll() { renderSidebar(); render(); }

function applyTheme() {
  document.body.className = document.body.className.replace(/theme-\S+/g, '').trim();
  document.body.classList.add(`theme-${db.settings.theme}`);
  applyAmbient();
}

const THEME_COLORS = {
  green: '#1ed760', purple: '#b388ff', gold: '#ffc107', red: '#ff3d71',
  blue: '#3d8bff', cyan: '#18e0e0', pink: '#ff6ad5',   orange: '#ff8a3d',
};
const THEME_NAMES = {
  green: 'Zelena', purple: 'Vijolična', gold: 'Zlata', red: 'Rdeča',
  blue: 'Modra', cyan: 'Turkizna', pink: 'Roza',   orange: 'Oranžna',
};
function applyAmbient() {
  const s = db.settings;
  const color = s.ambientCustom || THEME_COLORS[s.theme] || THEME_COLORS.green;
  const b = document.body;
  b.classList.toggle('ambient', !!s.ambient);
  b.style.setProperty('--amb', color);
  b.style.setProperty('--accent', color);
}
setInterval(() => {
  const s = db.settings;
  if (!s.ambient || !s.ambientPulse) { document.body.style.setProperty('--pulse', '0'); return; }
  let level = 0;
  if (analyser && cur && !audio.paused) {
    const d = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(d);
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += d[i];
    level = sum / 8 / 255;
  } else if (isPlaying()) level = 0.35 + 0.15 * Math.sin(Date.now() / 600);
  document.body.style.setProperty('--pulse', level.toFixed(2));
}, 80);

// ---------- Effects menu and visualizer ----------
const PRESETS = {
  flat: { label: 'Ravno', bass: 0, mid: 0, treble: 0 },
  bass: { label: 'Poudarjen bas', bass: 8, mid: -1, treble: 0 },
  vocal: { label: 'Vokal', bass: -2, mid: 5, treble: 2 },
  bright: { label: 'Svetlo', bass: -1, mid: 0, treble: 7 },
  party: { label: 'Zabava', bass: 6, mid: -2, treble: 5 },
};
let sleepTimer = null;
let sleepEnd = 0;
const SLEEP_FADE_MS = 15000;
function setSleep(minutes) {
  clearTimeout(sleepTimer);
  clearInterval(sleepFade);
  sleepTimer = null;
  sleepFade = null;
  sleepMul = 1;
  sleepEnd = 0;
  if (!minutes) { toast('Časovnik spanja izklopljen.'); return; }
  sleepEnd = Date.now() + minutes * 60000;
  const total = minutes * 60000;
  sleepTimer = setTimeout(() => {
    sleepTimer = null;
    const t0 = Date.now();
    sleepFade = setInterval(() => {
      sleepMul = Math.max(0, 1 - (Date.now() - t0) / SLEEP_FADE_MS);
      if (sleepMul > 0) return;
      clearInterval(sleepFade);
      sleepFade = null;
      if (!jamGuest() && cur && isPlaying()) togglePlay();
      sleepMul = 1;
      sleepEnd = 0;
      toast('Časovnik spanja: predvajanje ustavljeno.');
    }, 100);
  }, Math.max(0, total - SLEEP_FADE_MS));
  toast(`Predvajanje se ustavi čez ${minutes} min (s postopnim zatemnjenjem).`);
}

function drawFxMenu() {
  const s = db.settings;
  const row = (label, ...ctl) => h('div', { class: 'fxrow' }, h('label', {}, label), ...ctl);
  const slider = (min, max, step, get, set, unit = '') => {
    const out = h('span', { class: 'fxval' }, `${get()}${unit}`);
    const input = h('input', { type: 'range', min, max, step, value: get() });
    input.addEventListener('input', () => { set(Number(input.value)); out.textContent = `${input.value}${unit}`; });
    input.addEventListener('change', save);
    return [input, out];
  };
  const select = (opts, get, set) => h('select', { onchange: (e) => { set(e.target.value); save(); } },
    opts.map(([v, l]) => h('option', { value: v, selected: String(get()) === String(v) ? 'selected' : null }, l)));
  const m = $('#fxmenu');
  const items = [
    h('div', { class: 'fxsec' }, 'Prehodi'),
    row('Crossfade', ...slider(0, 12, 1, () => s.fade, (v) => { s.fade = v; }, ' s')),
    h('div', { class: 'fxsec' }, 'Izenačevalnik (samo uvožene datoteke)'),
    ...(cur && cur.type !== 'local' ? [h('div', { class: 'fxnote2' }, 'Trenutna skladba je z YouTuba – izenačevalnik deluje samo pri offline skladbah.')] : []),
    row('Predloga', select([...Object.entries(PRESETS).map(([k, p]) => [k, p.label]), ['', 'Po meri']], () => s.preset || '', (k) => {
      const p = PRESETS[k];
      if (!p) { s.preset = ''; return; }
      s.preset = k; s.eq = { bass: p.bass, mid: p.mid, treble: p.treble }; applyEq(); drawFxMenu();
    })),
    row('Bas', ...slider(-12, 12, 1, () => s.eq.bass, (v) => { s.eq.bass = v; s.preset = ''; applyEq(true); }, ' dB')),
    row('Srednji toni', ...slider(-12, 12, 1, () => s.eq.mid, (v) => { s.eq.mid = v; s.preset = ''; applyEq(true); }, ' dB')),
    row('Visoki toni', ...slider(-12, 12, 1, () => s.eq.treble, (v) => { s.eq.treble = v; s.preset = ''; applyEq(true); }, ' dB')),
    h('div', { class: 'fxsec' }, 'Predvajanje'),
    row('Hitrost', select([[0.75, '0.75×'], [1, '1×'], [1.25, '1.25×'], [1.5, '1.5×'], [2, '2×']], () => s.speed, (v) => { s.speed = Number(v); applySpeed(); })),
    row('Izenači glasnost', h('input', { type: 'checkbox', checked: s.normalize ? 'checked' : null, onchange: (e) => { s.normalize = e.target.checked; applyNormalize(); save(); } })),
    row('Preskoči uvod', ...slider(0, 30, 1, () => s.skipIntro || 0, (v) => { s.skipIntro = v; }, ' s')),
    row('Preskoči konec', ...slider(0, 30, 1, () => s.skipOutro || 0, (v) => { s.skipOutro = v; }, ' s')),
    row('Ponavljaj A–B', h('div', { class: 'abloop' },
      h('button', { class: 'btn sec', onclick: () => { if (!cur) return; loopA = getPos(); if (loopB !== null && loopB <= loopA) loopB = null; toast(`A: ${fmt(loopA)}`); drawFxMenu(); } }, loopA === null ? 'A' : `A ${fmt(loopA)}`),
      h('button', { class: 'btn sec', onclick: () => { if (!cur || loopA === null) { toast('Najprej nastavi točko A.'); return; } const p = getPos(); if (p <= loopA + 1) { toast('B mora biti za A.'); return; } loopB = p; toast(`Zanka ${fmt(loopA)} – ${fmt(loopB)}`); drawFxMenu(); } }, loopB === null ? 'B' : `B ${fmt(loopB)}`),
      h('button', { class: 'btn sec', onclick: () => { loopA = loopB = null; drawFxMenu(); } }, '✕'))),
    row('Časovnik spanja', select([[0, 'Izklopljen'], [15, '15 min'], [30, '30 min'], [60, '60 min'], [120, '120 min']], () => 0, (v) => setSleep(Number(v)))),
    h('div', { class: 'fxsec' }, 'Vizualizator'),
    row('Slog', select([['bars', 'Stolpci'], ['wave', 'Valovanje'], ['circle', 'Krog']], () => s.viz, (v) => { s.viz = v; })),
    h('div', { class: 'fxsec' }, 'Videz'),
    row('Tema', select(Object.entries(THEME_NAMES), () => s.theme, (v) => { s.theme = v; s.ambientCustom = ''; applyTheme(); drawFxMenu(); })),
    h('div', { class: 'fxsec' }, 'Ambient ozadje'),
    row(h('span', {}, '🎄 Božični način ', h('span', { class: 'beta-badge' }, 'BETA')), h('input', { type: 'checkbox', checked: s.snow ? 'checked' : null, onchange: (e) => {
      s.snow = e.target.checked;
      if (s.snow) {
        s.theme = 'green';
        s.ambientCustom = '';
        s.ambient = true;
        s.particles = true;
        applyTheme();
        startParticles();
      } else {
        startParticles();
        applyAmbient();
      }
      save(); drawFxMenu();
    } })),
    row('Ambient', h('input', { type: 'checkbox', checked: s.ambient ? 'checked' : null, onchange: (e) => { s.ambient = e.target.checked; applyAmbient(); save(); } })),
    row('Barva', h('div', { class: 'swatches' },
      ...Object.entries(THEME_COLORS).map(([k, c]) => h('button', {
        class: 'sw' + (!s.ambientCustom && s.theme === k ? ' on' : ''), title: THEME_NAMES[k], style: `background:${c}`,
        onclick: () => { s.theme = k; s.ambientCustom = ''; applyTheme(); save(); drawFxMenu(); },
      })),
      h('input', { type: 'color', title: 'Poljubna barva', value: s.ambientCustom || THEME_COLORS[s.theme] || '#1ed760',
        oninput: (e) => { s.ambientCustom = e.target.value; applyAmbient(); }, onchange: () => { save(); drawFxMenu(); } }))),
    row('Utripanje z glasbo', h('input', { type: 'checkbox', checked: s.ambientPulse ? 'checked' : null, onchange: (e) => { s.ambientPulse = e.target.checked; save(); } })),
    row('Padajoče pikice', h('input', { type: 'checkbox', checked: s.particles !== false ? 'checked' : null, onchange: (e) => { s.particles = e.target.checked; save(); startParticles(); } })),
  ];
  const TAB_OF = { Prehodi: 'zvok', 'Izenačevalnik (samo uvožene datoteke)': 'zvok', Predvajanje: 'play', Vizualizator: 'play', Videz: 'look', 'Ambient ozadje': 'look' };
  const TABS = [
    ['zvok', 'Zvok', svg('M4 7h10V5h2v2h4v2h-4v2h-2V9H4zm0 8h4v-2h2v2h10v2H10v2H8v-2H4z', 16)],
    ['play', 'Predvajanje', svg('M8 5v14l11-7z', 16)],
    ['look', 'Videz', svg('M12 3a9 9 0 0 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.300-.3-.3-.5-.8-.5-1.300 0-1.100.9-2 2-2h2.400A3.600 3.600 0 0 0 21 10.800C21 6.500 17 3 12 3zM7.500 12a1.500 1.500 0 1 1 0-3 1.500 1.500 0 0 1 0 3zm3-4a1.500 1.500 0 1 1 0-3 1.500 1.500 0 0 1 0 3zm5 0a1.500 1.500 0 1 1 0-3 1.500 1.500 0 0 1 0 3z', 16)],
  ];
  if (!TABS.some((t) => t[0] === fxTab)) fxTab = 'zvok';
  const cards = {};
  let curCard = null;
  for (const it of items) {
    if (it.classList.contains('fxsec')) {
      const tab = TAB_OF[it.textContent] || 'zvok';
      curCard = h('section', { class: 'fxcard' }, it);
      (cards[tab] = cards[tab] || []).push(curCard);
    } else curCard.append(it);
  }
  m.replaceChildren(
    h('div', { class: 'fxhead' }, h('span', {}, 'Nastavitve'), h('small', {}, db.settings.ambient ? 'Ambient vklopljen' : '')),
    h('div', { class: 'fxtabs' }, TABS.map(([k, l, ic]) => {
      const b = h('button', { class: k === fxTab ? 'on' : '', onclick: () => { fxTab = k; drawFxMenu(); } });
      b.innerHTML = `${ic}<span>${l}</span>`;
      return b;
    })),
    h('div', { class: 'fxbody' }, cards[fxTab] || []),
    h('div', { class: 'fxnote' }, 'Izenačevalnik, normalizacija in vizualizator v živo delujejo za offline skladbe. Pri YouTube skladbah ni mogoče, ker zvok predvaja uradni YouTube predvajalnik.'));
}
let fxTab = 'zvok';
$('#btn-fx').onclick = (e) => {
  e.stopPropagation();
  const m = $('#fxmenu');
  if (!m.hidden) { m.hidden = true; return; }
  drawFxMenu();
  m.hidden = false;
};
$('#fxmenu').addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', () => { $('#fxmenu').hidden = true; });

let vizRaf = 0;
const vizData = new Uint8Array(256);
let vizPhase = 0;
function vizSample() {
  if (cur && analyser && !audio.paused) return true;
  return false;
}
function vizLoop() {
  const canvas = $('#viz-canvas');
  if (!canvas || view !== 'visualizer') { vizRaf = 0; return; }
  const ctx = canvas.getContext('2d');
  const w = canvas.clientWidth;
  const hgt = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; }
  const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#1ed760';
  const settings = db.settings;
  const real = vizSample();
  if (analyser) analyser.smoothingTimeConstant = Number(settings.vizSmoothing) || 0;
  const n = 64;
  const data = new Float32Array(n);
  if (real) {
    analyser.getByteFrequencyData(vizData);
    for (let i = 0; i < n; i++) data[i] = vizData[Math.floor((i / n) * 160)] / 255;
  } else if (cur && isPlaying()) {
    vizPhase += 0.08;
    for (let i = 0; i < n; i++) data[i] = 0.25 + 0.2 * Math.sin(vizPhase + i * 0.3) + 0.12 * Math.sin(vizPhase * 1.7 + i * 0.11);
  }
  ctx.clearRect(0, 0, w, hgt);
  const colorFor = (index) => {
    if (settings.vizColor === 'rainbow') return `hsl(${(index / n) * 320 + vizPhase * 30},90%,62%)`;
    if (settings.vizColor === 'electric') return `hsl(${195 + (index / n) * 95},100%,65%)`;
    return accent;
  };
  ctx.lineWidth = 3;
  ctx.shadowBlur = settings.vizGlow ? 16 : 0;
  const mode = settings.viz;
  if (mode === 'bars') {
    const bw = w / n;
    for (let i = 0; i < n; i++) {
      const bh = Math.max(3, data[i] * hgt * 0.9);
      ctx.globalAlpha = 0.45 + data[i] * 0.55;
      ctx.fillStyle = colorFor(i);
      ctx.shadowColor = colorFor(i);
      ctx.fillRect(i * bw + 2, hgt - bh, bw - 4, bh);
    }
  } else if (mode === 'wave') {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const y = hgt / 2 + (i % 2 ? -1 : 1) * data[i] * hgt * 0.4;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = colorFor(n / 2);
    ctx.shadowColor = ctx.strokeStyle;
    ctx.stroke();
  } else if (mode === 'circle') {
    const cx = w / 2;
    const cy = hgt / 2;
    const r = Math.min(w, hgt) * 0.22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const len = 6 + data[i] * Math.min(w, hgt) * 0.25;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len));
      ctx.strokeStyle = colorFor(i);
      ctx.shadowColor = ctx.strokeStyle;
      ctx.stroke();
    }
  } else if (mode === 'mirror') {
    const bw = w / n;
    for (let i = 0; i < n; i++) {
      const bh = Math.max(2, data[i] * hgt * 0.42);
      ctx.fillStyle = colorFor(i);
      ctx.shadowColor = ctx.fillStyle;
      ctx.globalAlpha = 0.4 + data[i] * 0.6;
      ctx.fillRect(i * bw + 2, hgt / 2 - bh, bw - 4, bh);
      ctx.fillRect(i * bw + 2, hgt / 2, bw - 4, bh);
    }
  } else {
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const y = hgt * (0.72 - data[i] * 0.45);
      const radius = 2 + data[i] * 17;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = colorFor(i);
      ctx.shadowColor = ctx.fillStyle;
      ctx.globalAlpha = 0.35 + data[i] * 0.65;
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  vizRaf = requestAnimationFrame(vizLoop);
}

// Top-right avatar menu
$('#avatar-btn').onclick = (e) => {
  e.stopPropagation();
  const m = $('#menu');
  if (!m.hidden) { m.hidden = true; return; }
  const go = (v) => () => { m.hidden = true; view = v; viewArg = null; renderAll(); };
  m.replaceChildren(
    h('button', { onclick: go('profile') }, 'Profil'),
    h('button', { onclick: go('settings') }, 'Nastavitve'),
    h('hr'),
    h('button', { onclick: () => { m.hidden = true; logout(); } }, 'Odjava'));
  m.hidden = false;
};
document.addEventListener('click', () => { $('#menu').hidden = true; });

let appVersion = '';
window.gmajna.getVersion().then((v) => { appVersion = v; const el = $('#appver'); if (el) el.textContent = `v${v}`; });
function updateNet() { if (account) renderSidebar(); }
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);

// ---------- Jam ----------
const jam = {
  socket: null, serverUrl: '', room: '', isHost: false, hostToken: '', hostId: '',
  controlAllowed: false, members: [], connected: false,
};
const jamGuest = () => !!jam.room && !jam.isHost;
const slimTrack = (t) => (t.type === 'yt' ? t : { id: t.id, type: 'local', title: t.title, artist: t.artist });
const refreshJam = () => { if (account) { renderSidebar(); if (view === 'jam') render(); } };
const pendingJamInvites = new Map();
const processingJamInvites = new Set();

function renderJamInvitePopups() {
  let host = $('#jam-invite-popups');
  if (!host) {
    host = h('div', { id: 'jam-invite-popups', 'aria-live': 'polite' });
    document.body.append(host);
  }
  const invites = [...pendingJamInvites.values()];
  host.replaceChildren(...invites.map((invite) => h('section', { class: 'jam-invite-popup' },
    userDot(invite.sender, 38),
    h('div', { class: 'jam-invite-copy' },
      h('strong', {}, invite.sender.name),
      h('span', {}, 'te vabi v Jam')),
    h('div', { class: 'jam-invite-actions' },
      h('button', { class: 'btn', disabled: processingJamInvites.has(invite.id), onclick: () => acceptJamInvite(invite.id) }, 'Sprejmi'),
      h('button', { class: 'btn sec', disabled: processingJamInvites.has(invite.id), onclick: () => declineJamInvite(invite.id) }, 'Zavrni')))));
}

async function pollJamInvites() {
  if (!cloudOn() || jamInvitePollBusy) return;
  const activeAccount = account;
  jamInvitePollBusy = true;
  try {
    const response = await cloud('GET', '/api/jam/invites', null, activeAccount.token);
    if (!response.ok || account !== activeAccount) return;
    pendingJamInvites.clear();
    for (const invite of Array.isArray(response.json.invites) ? response.json.invites : []) {
      if (invite && typeof invite.id === 'string' && typeof invite.room === 'string'
          && invite.sender && typeof invite.sender.name === 'string') {
        pendingJamInvites.set(invite.id, invite);
      }
    }
    renderJamInvitePopups();
  } finally {
    jamInvitePollBusy = false;
  }
}

async function acceptJamInvite(id) {
  const invite = pendingJamInvites.get(id);
  if (!invite || !cloudOn() || processingJamInvites.has(id)) return;
  if (jam.room && !(await confirmBox('Pridruži se Jamu', 'Če sprejmeš, boš zapustil trenutni Jam.'))) return;
  processingJamInvites.add(id);
  renderJamInvitePopups();
  try {
    const response = await cloud('POST', `/api/jam/invites/${encodeURIComponent(id)}/accept`, {}, account.token);
    if (!response.ok) { toast(response.json.error || 'Povabilu se ni mogoče pridružiti.'); return; }
    pendingJamInvites.delete(id);
    if (jam.room) jamLeave(true);
    view = 'jam';
    viewArg = null;
    jamJoin(response.json.room);
    renderAll();
  } finally {
    processingJamInvites.delete(id);
    renderJamInvitePopups();
  }
}

async function declineJamInvite(id) {
  if (!cloudOn() || processingJamInvites.has(id)) return;
  processingJamInvites.add(id);
  renderJamInvitePopups();
  try {
    const response = await cloud('DELETE', `/api/jam/invites/${encodeURIComponent(id)}`, null, account.token);
    if (!response.ok) { toast(response.json.error || 'Povabila ni mogoče zavrniti.'); return; }
    pendingJamInvites.delete(id);
  } finally {
    processingJamInvites.delete(id);
    renderJamInvitePopups();
  }
}

async function inviteJamFriend() {
  if (!jam.isHost || !jam.room || !cloudOn()) return;
  await socialRefresh(true);
  const options = social.friends.map((friend) => ({ label: friend.name, value: friend.id }));
  if (!options.length) { toast('Ni prijateljev za povabilo. Dodaj jih v zavihku Uporabniki.'); return; }
  const userId = await choose('Povabi prijatelja v Jam', options);
  if (!userId) return;
  const response = await cloud('POST', '/api/jam/invites', { userId, room: jam.room }, account.token);
  if (!response.ok) { toast(response.json.error || 'Povabila ni mogoče poslati.'); return; }
  toast('Povabilo v Jam poslano.');
}

let jamInvitePollBusy = false;
setInterval(() => { if (!document.hidden) void pollJamInvites(); }, 10000);

function jamOpen(room, host) {
  let serverUrl;
  try { serverUrl = normalizeAccountApiUrl(currentAccountApiUrl()); }
  catch (e) { toast(`Neveljaven Rythmify strežnik: ${e.message}`); return; }
  jamLeave(true);
  Object.assign(jam, { serverUrl, room, isHost: host, hostToken: host ? rid() + rid() : '', hostId: '', controlAllowed: false, members: [], connected: false });
  const socket = io(serverUrl, { transports: ['websocket', 'polling'] });
  jam.socket = socket;
  socket.on('connect', () => {
    jam.connected = true;
    socket.emit('join', room);
    socket.emit('jam:register', { peerId: db.peerId, name: account.name, wantsHost: host, hostToken: jam.hostToken });
    refreshJam();
  });
  socket.on('disconnect', () => { jam.connected = false; refreshJam(); });
  socket.on('jam:state', (s) => {
    Object.assign(jam, { hostId: s.hostId, controlAllowed: s.controlAllowed, members: s.members });
    jamBroadcast(true);
    refreshJam();
  });
  socket.on('jam:error', (m) => { toast(m); jamLeave(true); refreshJam(); });
  socket.on('jam:ended', () => { toast('Jam je končan.'); jamLeave(true); refreshJam(); });
  socket.on('sync', jamOnSync);
}
function jamHost() { jamOpen(`jam-${rid().slice(0, 10)}`, true); refreshJam(); }
function jamJoin(code) {
  if (!/^[\w-]{1,100}$/.test(code)) { toast('Neveljavna koda.'); return; }
  jamOpen(code, false);
  refreshJam();
}
let pendingJamInvite = null;
function receiveJamInvite(invite) {
  const room = typeof invite?.room === 'string' ? invite.room : '';
  if (!/^[\w-]{1,100}$/.test(room)) { toast('Povabilo v Jam ni veljavno.'); return; }
  let server;
  try { server = normalizeAccountApiUrl(invite.server); }
  catch (e) { toast(`Neveljaven strežnik v povabilu: ${e.message}`); return; }
  pendingJamInvite = { room, server };
  if (account) void openPendingJamInvite();
  else toast('Povabilo je shranjeno. Prijavi se, da se pridružiš Jamu.');
}
async function openPendingJamInvite() {
  if (!account || !pendingJamInvite) return;
  let currentServer;
  try { currentServer = normalizeAccountApiUrl(currentAccountApiUrl()); }
  catch (e) { toast(`Neveljaven Rythmify strežnik: ${e.message}`); return; }
  if (currentServer !== pendingJamInvite.server) {
    toast('Povabilo je za drug Rythmify strežnik. Prosi gostitelja za novo povezavo.');
    return;
  }
  const { room } = pendingJamInvite;
  pendingJamInvite = null;
  view = 'jam';
  viewArg = null;
  jamJoin(room);
  renderAll();
}
window.gmajna.onJamInvite(receiveJamInvite);
function jamLeave(silent) {
  const s = jam.socket;
  const wasHost = jam.isHost;
  Object.assign(jam, { socket: null, serverUrl: '', room: '', isHost: false, members: [], connected: false });
  if (s) {
    s.removeAllListeners();
    if (wasHost && !silent) s.emit('jam:close');
    // Give the close message time to flush before dropping the connection.
    setTimeout(() => s.disconnect(), wasHost && !silent ? 300 : 0);
  }
  if (!silent) { toast(wasHost ? 'Jam je končan.' : 'Zapustil si Jam.'); refreshJam(); }
}
function jamBroadcast(force) {
  if (!jam.isHost || !jam.connected || !cur) return;
  const now = Date.now();
  if (!force && now - (jamBroadcast.last || 0) < 200) return;
  jamBroadcast.last = now;
  jam.socket.emit('sync', { a: 'presence', track: slimTrack(cur), pos: getPos(), playing: isPlaying() });
}
setInterval(() => jamBroadcast(true), 1000);

function jamCommand(cmd, payload = {}) {
  if (!jam.controlAllowed) { toast('Gostitelj ni dovolil upravljanja.'); return; }
  jam.socket.emit('sync', { a: 'cmd', cmd, ...payload });
}

function cleanWeb(t) {
  if (!t || t.type !== 'yt' || !/^[\w-]{11}$/.test(t.videoId || '')) return null;
  return {
    id: `yt:${t.videoId}`, type: 'yt', videoId: t.videoId,
    title: String(t.title || '').slice(0, 200), artist: String(t.artist || '').slice(0, 200),
    cover: typeof t.cover === 'string' && /^https:\/\/i\.ytimg\.com\//.test(t.cover) ? t.cover : '',
  };
}

async function jamOnSync(p) {
  if (jam.isHost) {
    if (p.a !== 'cmd') return;
    if (p.cmd === 'toggle') togglePlay();
    else if (p.cmd === 'next') next(false);
    else if (p.cmd === 'prev') prev();
    else if (p.cmd === 'play') {
      const t = cleanWeb(p.track);
      if (t) playTrack(t);
    }
    return;
  }
  if (p.a !== 'presence' || !p.isHost || !p.track) return;
  const t = cleanWeb(p.track);
  if (!t) {
    if (isPlaying()) { stopEngines(); updatePlayBtn(); }
    $('#now-title').textContent = String(p.track.title || '');
    $('#now-artist').textContent = `${String(p.track.artist || '')} · lokalna skladba gostitelja`;
    return;
  }
  if (!cur || cur.id !== t.id) {
    if (jamOnSync.loading) return;
    jamOnSync.loading = true;
    try {
      await playTrack(t, { start: p.pos, queue: [] });
      if (!p.playing) enginePause();
    } finally { jamOnSync.loading = false; }
    return;
  }
  const now = Date.now();
  if (Math.abs(getPos() - p.pos) > 2 && now - (jamOnSync.lastSeek || 0) > 3000) { jamOnSync.lastSeek = now; engineSeek(p.pos); }
  if (p.playing && !isPlaying()) enginePlay();
  if (!p.playing && isPlaying()) enginePause();
}

// ---------- Init ----------
(async function init() {
  const stored = await window.gmajna.getStore();
  if (Array.isArray(stored.accounts)) {
    root = {
      accounts: stored.accounts,
      session: stored.session || '',
      legacy: stored.legacy || null,
    };
  } else {
    root = { accounts: [], session: '', legacy: stored.library ? stored : null };
  }
  if (Object.prototype.hasOwnProperty.call(stored, 'accountServer')) await window.gmajna.setStore(root);
  updateNet();
  const remembered = root.accounts.find((a) => a.id === root.session);
  if (remembered) enterAccount(remembered); else showAuth();
})();

'use strict';

// Copies desktop-only runtime files (YouTube Music client, Socket.IO) into the Android web assets after `cap sync`.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const target = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'public');
const files = [
  [path.join(root, 'ytmusic.js'), path.join(target, 'ytmusic.js')],
  [path.join(root, 'node_modules', 'socket.io-client', 'dist', 'socket.io.min.js'), path.join(target, 'vendor', 'socket.io.js')],
];

for (const [from, to] of files) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log(`copied ${path.relative(root, from)} -> ${path.relative(root, to)}`);
}

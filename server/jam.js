const { Server } = require('socket.io');

const ROOM_RE = /^[\w-]{1,100}$/;

function publicUrl(port) {
  const value = process.env.JAM_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${port}`;
  let url;
  try { url = new URL(value); }
  catch { throw new Error('JAM_PUBLIC_URL or RENDER_EXTERNAL_URL is not a valid URL.'); }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local))
      || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('JAM_PUBLIC_URL must be an HTTPS origin (HTTP is allowed only for localhost).');
  }
  return url.origin;
}

function html(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function addInviteRoutes(app, baseUrl) {
  const renderInvite = (req, res, room) => {
    if (typeof room !== 'string' || !ROOM_RE.test(room)) {
      return res.status(400).type('text/plain').send('Neveljavna povabilna povezava.');
    }
    const appUrl = `gmajna://join?server=${encodeURIComponent(baseUrl)}&room=${encodeURIComponent(room)}`;
    res.set('Cache-Control', 'no-store').type('html').send(`<!doctype html>
<html lang="sl">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pridruži se Rythmify Jamu</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0d12;color:#fff;font:16px Arial,sans-serif}
  main{box-sizing:border-box;width:min(420px,calc(100% - 32px));padding:28px;border:1px solid #30303a;border-radius:18px;background:#16161d;text-align:center}
  h1{font-size:22px}p{color:#bdbdc7;line-height:1.5}
  a{display:block;margin:18px 0;padding:13px;border-radius:10px;background:#ff3d71;color:#fff;text-decoration:none;font-weight:700}
  code{display:inline-block;padding:8px 12px;border-radius:8px;background:#25252e;font-size:17px}
  small{color:#999}
</style>
<main><h1>Rythmify Jam</h1><p>Gostitelj te vabi k skupnemu poslušanju. Odpri povabilo v Rythmify.</p>
<a href="${html(appUrl)}">Odpri Rythmify</a><p>Koda sobe: <code>${html(room)}</code></p>
<small>Če se aplikacija ne odpre, v Rythmify izberi Jam → Pridruži se s kodo.</small></main>
</html>`);
  };

  app.get('/join', (req, res) => renderInvite(req, res, req.query.room));
  app.get('/j/:room', (req, res) => renderInvite(req, res, req.params.room));
}

function attachJam(app, httpServer, port) {
  const rooms = new Map();
  const baseUrl = publicUrl(port);
  addInviteRoutes(app, baseUrl);

  const io = new Server(httpServer, {
    cors: { origin: '*' },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  function sendRoomState(room) {
    const state = rooms.get(room);
    if (!state) return;
    const payload = {
      hostId: state.hostId,
      controlAllowed: state.controlAllowed,
      members: [...state.members.values()].map(({ peerId, name }) => ({ peerId, name })),
    };
    for (const member of state.members.values()) {
      io.to(member.socketId).emit('jam:state', payload);
    }
  }

  function closeRoom(room, state) {
    io.to(room).emit('jam:ended');
    for (const member of state.members.values()) {
      const socket = io.sockets.sockets.get(member.socketId);
      if (socket) {
        socket.leave(room);
        socket.data.jamRoom = '';
        socket.data.peerId = '';
      }
    }
    rooms.delete(room);
  }

  io.on('connection', (socket) => {
    socket.on('join', (room) => {
      if (typeof room !== 'string' || !ROOM_RE.test(room)) {
        socket.emit('jam:error', 'Neveljavna koda sobe.');
        return;
      }
      socket.data.jamRoom = room;
      socket.join(room);
    });

    socket.on('jam:register', (data = {}) => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
      const room = socket.data.jamRoom;
      const { peerId, name, wantsHost } = data;
      if (!room || typeof peerId !== 'string' || !ROOM_RE.test(peerId)) {
        socket.emit('jam:error', 'Neveljavna soba ali ID poslušalca.');
        return;
      }

      let state = rooms.get(room);
      if (!state && wantsHost === true && typeof data.hostToken === 'string'
          && /^[\w-]{20,100}$/.test(data.hostToken)) {
        state = {
          hostId: '',
          hostToken: data.hostToken,
          controlAllowed: true,
          members: new Map(),
          latestPresence: null,
        };
        rooms.set(room, state);
      }
      if (!state) {
        socket.emit('jam:error', 'Gostitelj še ni ustvaril tega jama.');
        return;
      }

      if (wantsHost === true) {
        if (data.hostToken !== state.hostToken) {
          socket.emit('jam:error', 'Ta jam že ima drugega gostitelja.');
          return;
        }
        state.hostId = peerId;
      } else if (!state.hostId) {
        socket.emit('jam:error', 'Gostitelj še ni ustvaril tega jama.');
        return;
      }

      const previous = state.members.get(peerId);
      if (previous && previous.socketId !== socket.id) {
        io.sockets.sockets.get(previous.socketId)?.disconnect(true);
      }
      socket.data.peerId = peerId;
      state.members.set(peerId, {
        peerId,
        name: typeof name === 'string' ? name.slice(0, 40) : 'Poslušalec',
        socketId: socket.id,
      });

      sendRoomState(room);
      if (state.latestPresence) socket.emit('sync', state.latestPresence);
    });

    socket.on('jam:control', (data = {}) => {
      const room = socket.data.jamRoom;
      const state = room && rooms.get(room);
      if (!state || socket.data.peerId !== state.hostId) return;
      state.controlAllowed = !!data && typeof data === 'object' && data.enabled === true;
      sendRoomState(room);
    });

    socket.on('jam:close', () => {
      const room = socket.data.jamRoom;
      const state = room && rooms.get(room);
      if (!state || socket.data.peerId !== state.hostId) return;
      closeRoom(room, state);
    });

    socket.on('sync', (data) => {
      const room = socket.data.jamRoom;
      const state = room && rooms.get(room);
      const member = state && state.members.get(socket.data.peerId);
      if (!state || !member || !data || typeof data !== 'object' || Array.isArray(data)) return;

      const isHost = member.peerId === state.hostId;
      if (data.a === 'close' && isHost) {
        closeRoom(room, state);
        return;
      }
      if (data.a === 'presence' && !isHost) {
        const packet = {
          ...data,
          peerId: member.peerId,
          hostId: state.hostId,
          isHost: false,
          controlAllowed: state.controlAllowed,
        };
        socket.to(room).emit('sync', packet);
        return;
      }
      if (!isHost && !state.controlAllowed) return;

      const packet = {
        ...data,
        peerId: member.peerId,
        hostId: state.hostId,
        isHost,
        controlAllowed: state.controlAllowed,
      };
      if (data.a === 'presence') state.latestPresence = packet;
      socket.to(room).emit('sync', packet);
    });

    socket.on('disconnect', () => {
      const room = socket.data.jamRoom;
      const state = room && rooms.get(room);
      const member = state && state.members.get(socket.data.peerId);
      if (!member || member.socketId !== socket.id) return;
      state.members.delete(socket.data.peerId);
      sendRoomState(room);
    });
  });

  return io;
}

module.exports = attachJam;

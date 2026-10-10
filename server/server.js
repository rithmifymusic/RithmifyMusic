const crypto = require('crypto');
const http = require('http');
const express = require('express');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const attachJam = require('./jam');

const PORT = process.env.PORT || 3000;
if (!process.env.DATABASE_URL) { console.error('Manjka DATABASE_URL'); process.exit(1); }
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false },
});

const mailer = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}) : null;
const FROM = process.env.MAIL_FROM || process.env.SMTP_USER || 'Gmajna Music <no-reply@gmajna.app>';

async function sendMail(to, subject, text) {
  if (!to) return false;
  if (process.env.RESEND_API_KEY) {
    if (!process.env.MAIL_FROM) {
      console.error('Resend mail error: MAIL_FROM is not configured.');
      return false;
    }
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to, subject, text }),
      });
      if (!r.ok) {
        console.error('Resend mail error:', r.status, (await r.text()).slice(0, 300));
        return false;
      }
      return true;
    } catch (e) {
      console.error('Resend mail error:', e.message);
      return false;
    }
  }
  if (!mailer) {
    console.warn('Mail not sent: configure RESEND_API_KEY or SMTP_HOST.');
    return false;
  }
  try { await mailer.sendMail({ from: FROM, to, subject, text }); return true; }
  catch (e) { console.error('SMTP mail error:', e.message); return false; }
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const scrypt = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const isHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
};

function publicAcc(r) {
  return { id: r.id, name: r.name, email: r.email, color: r.color, salt: r.client_salt, hash: r.client_hash, data: r.data, updatedAt: Number(r.updated_at) };
}

async function stripeRequest(path, params, method = 'POST') {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe ni konfiguriran: manjka STRIPE_SECRET_KEY.');
  const headers = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` };
  const options = { method, headers, signal: AbortSignal.timeout(15000) };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    options.body = new URLSearchParams(params);
  }
  const r = await fetch(`https://api.stripe.com/v1${path}`, options);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error?.message || `Stripe je vrnil HTTP ${r.status}.`);
  return body;
}

function validStripeSignature(payload, signature, secret) {
  if (!Buffer.isBuffer(payload) || typeof signature !== 'string' || !secret) return false;
  const parts = signature.split(',').map((part) => part.split('=', 2));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const candidates = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(payload).digest();
  return candidates.some((value) => {
    if (!/^[\da-f]{64}$/i.test(value)) return false;
    const candidate = Buffer.from(value, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  });
}

async function storeStripeSubscription(subscription, accountId, eventTime = Date.now()) {
  const existing = await pool.query(
    'SELECT account_id FROM billing_subscriptions WHERE stripe_subscription_id=$1 OR stripe_customer_id=$2 LIMIT 1',
    [subscription.id, subscription.customer]);
  const id = accountId || existing.rows[0]?.account_id;
  if (!id) return false;
  await pool.query(
    `INSERT INTO billing_subscriptions
       (account_id,stripe_customer_id,stripe_subscription_id,status,cancel_at_period_end,current_period_end,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (account_id) DO UPDATE SET
       stripe_customer_id=EXCLUDED.stripe_customer_id,
       stripe_subscription_id=EXCLUDED.stripe_subscription_id,
       status=EXCLUDED.status,
       cancel_at_period_end=EXCLUDED.cancel_at_period_end,
       current_period_end=EXCLUDED.current_period_end,
       updated_at=EXCLUDED.updated_at
     WHERE billing_subscriptions.updated_at <= EXCLUDED.updated_at`,
    [id, subscription.customer || null, subscription.id || null, str(subscription.status, 40) || 'incomplete',
      !!subscription.cancel_at_period_end, Number(subscription.current_period_end || 0) * 1000, eventTime]);
  return true;
}

const app = express();
app.post('/api/billing/stripe-webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  if (!validStripeSignature(req.body, req.get('Stripe-Signature'), process.env.STRIPE_WEBHOOK_SECRET)) {
    return res.status(400).json({ error: 'Neveljaven Stripe podpis.' });
  }
  try {
    const event = JSON.parse(req.body.toString('utf8'));
    const object = event.data?.object;
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated'
      || event.type === 'customer.subscription.deleted') {
      await storeStripeSubscription(object, object.metadata?.account_id, Number(event.created || 0) * 1000);
    } else if (event.type === 'checkout.session.completed') {
      const subscriptionId = typeof object.subscription === 'string' ? object.subscription : object.subscription?.id;
      if (subscriptionId) {
        const subscription = await stripeRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, null, 'GET');
        await storeStripeSubscription(subscription, object.metadata?.account_id || object.client_reference_id);
      }
    } else if (event.type === 'invoice.payment_failed' && object.customer) {
      await pool.query(
        `UPDATE billing_subscriptions SET status='past_due',updated_at=$1 WHERE stripe_customer_id=$2 AND updated_at <= $1`,
        [Number(event.created || 0) * 1000, object.customer]);
    }
    res.json({ received: true });
  } catch (e) {
    console.error('Stripe webhook:', e.message);
    res.status(500).json({ error: 'Stripe dogodek ni bil obdelan.' });
  }
});
app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const hits = new Map();
app.use((req, res, next) => {
  const k = req.ip + req.path;
  const now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(k, arr);
  if (arr.length > 60) return res.status(429).json({ error: 'Preveč zahtev.' });
  next();
});

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch((e) => { console.error(e); res.status(500).json({ error: 'Napaka strežnika.' }); });

const httpServer = http.createServer(app);
attachJam(app, httpServer, PORT);

const auth = wrap(async (req, res, next) => {
  const token = (req.get('Authorization') || '').replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'Ni prijave.' });
  const { rows } = await pool.query('SELECT * FROM accounts WHERE token_hash=$1', [sha(token)]);
  if (!rows[0]) return res.status(401).json({ error: 'Seja je potekla.' });
  req.acc = rows[0];
  next();
});

app.get('/', (_req, res) => res.send('Rythmify accounts and Jam server OK'));
app.get('/health', wrap(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, database: true, jam: true });
}));
app.get('/billing/success', (_req, res) => res.type('html').send(
  '<!doctype html><html lang="sl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Rythmify Premium</title><body style="font:16px sans-serif;background:#121212;color:#fff;text-align:center;padding:15vh 20px"><h1>Hvala za naročilo!</h1><p>Vrni se v Rythmify in v profilu izberi »Osveži stanje«.</p></body></html>'));
app.get('/billing/cancel', (_req, res) => res.type('html').send(
  '<!doctype html><html lang="sl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Rythmify Premium</title><body style="font:16px sans-serif;background:#121212;color:#fff;text-align:center;padding:15vh 20px"><h1>Nakup je bil preklican</h1><p>V aplikaciji lahko poskusiš znova kadarkoli.</p></body></html>'));

// Unknown accounts get a stable fake salt so account existence is not leaked.
app.get('/api/salt', wrap(async (req, res) => {
  const key = str(req.query.key, 120).trim().toLowerCase();
  const { rows } = await pool.query('SELECT client_salt FROM accounts WHERE email=$1 OR lower(name)=$1', [key]);
  const fake = crypto.createHash('sha256').update('fake' + key).digest().subarray(0, 16).toString('base64');
  res.json({ salt: rows[0]?.client_salt || fake });
}));

app.post('/api/register', wrap(async (req, res) => {
  const b = req.body || {};
  const id = str(b.id, 40), name = str(b.name, 24).trim(), email = str(b.email, 120).trim().toLowerCase();
  const salt = str(b.salt, 64), hash = str(b.hash, 128), color = str(b.color, 16);
  if (!id || name.length < 2 || !EMAIL_RE.test(email) || !salt || !hash) return res.status(400).json({ error: 'Neveljavni podatki.' });
  const dup = await pool.query('SELECT 1 FROM accounts WHERE email=$1 OR lower(name)=lower($2) OR id=$3', [email, name, id]);
  if (dup.rowCount) return res.status(409).json({ error: 'Ime ali e-pošta je že zasedena.' });
  const token = crypto.randomBytes(32).toString('hex');
  const srvSalt = crypto.randomBytes(16).toString('hex');
  await pool.query(
    `INSERT INTO accounts (id,name,email,color,client_salt,client_hash,srv_salt,srv_hash,token_hash,data,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, name, email, color, salt, hash, srvSalt, scrypt(hash, srvSalt), sha(token), JSON.stringify(b.data || {}), Date.now()]);
  sendMail(email, 'Dobrodošel v Gmajna Music', `Živjo ${name},\n\nTvoj profil v Gmajna Music je ustvarjen.\nUporabniško ime: ${name}\nE-pošta: ${email}\n\nČe profila nisi ustvaril ti, nam odgovori na to sporočilo.`);
  res.json({ token });
}));

app.post('/api/login', wrap(async (req, res) => {
  const key = str(req.body?.key, 120).trim().toLowerCase();
  const hash = str(req.body?.hash, 128);
  const { rows } = await pool.query('SELECT * FROM accounts WHERE email=$1 OR lower(name)=$1', [key]);
  const r = rows[0];
  const ok = r && crypto.timingSafeEqual(Buffer.from(scrypt(hash, r.srv_salt)), Buffer.from(r.srv_hash));
  if (!ok) return res.status(401).json({ error: 'Napačno ime ali geslo.' });
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('UPDATE accounts SET token_hash=$1 WHERE id=$2', [sha(token), r.id]);
  res.json({ token, account: publicAcc(r) });
}));

app.get('/api/account', auth, wrap(async (req, res) => res.json({ account: publicAcc(req.acc) })));

app.get('/api/billing/status', auth, wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT status,cancel_at_period_end,current_period_end FROM billing_subscriptions WHERE account_id=$1', [req.acc.id]);
  const subscription = rows[0] || {};
  const active = ['active', 'trialing'].includes(subscription.status)
    && Number(subscription.current_period_end || 0) > Date.now();
  res.json({
    accountId: req.acc.id,
    isPremium: active,
    status: subscription.status || 'free',
    cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
    currentPeriodEnd: Number(subscription.current_period_end || 0),
  });
}));

app.post('/api/billing/checkout', auth, wrap(async (req, res) => {
  const price = process.env.STRIPE_PRICE_ID;
  const successUrl = process.env.STRIPE_SUCCESS_URL;
  const cancelUrl = process.env.STRIPE_CANCEL_URL;
  if (!process.env.STRIPE_SECRET_KEY || !price || !isHttpsUrl(successUrl) || !isHttpsUrl(cancelUrl)) {
    return res.status(503).json({ error: 'Premium nakupi še niso konfigurirani na strežniku.' });
  }
  const { rows } = await pool.query('SELECT status,current_period_end,stripe_customer_id FROM billing_subscriptions WHERE account_id=$1', [req.acc.id]);
  const current = rows[0];
  if (current && ['active', 'trialing'].includes(current.status) && Number(current.current_period_end) > Date.now()) {
    return res.status(409).json({ error: 'Premium naročnina je že aktivna.' });
  }
  const params = {
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: req.acc.id,
    'metadata[account_id]': req.acc.id,
    'subscription_data[metadata][account_id]': req.acc.id,
  };
  if (current?.stripe_customer_id) params.customer = current.stripe_customer_id;
  else params.customer_email = req.acc.email;
  let checkout;
  try { checkout = await stripeRequest('/checkout/sessions', params); }
  catch (e) {
    console.error('Stripe checkout:', e.message);
    return res.status(502).json({ error: `Stripe Checkout ni uspel: ${e.message}` });
  }
  if (!/^https:\/\/checkout\.stripe\.com\//.test(checkout.url || '')) {
    throw new Error('Stripe ni vrnil veljavnega URL-ja za plačilo.');
  }
  res.json({ url: checkout.url });
}));

app.post('/api/billing/portal', auth, wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT stripe_customer_id FROM billing_subscriptions WHERE account_id=$1', [req.acc.id]);
  const returnUrl = process.env.STRIPE_RETURN_URL || process.env.STRIPE_SUCCESS_URL;
  if (!rows[0]?.stripe_customer_id) return res.status(409).json({ error: 'Za ta profil še ni Stripe naročnine.' });
  if (!process.env.STRIPE_SECRET_KEY || !isHttpsUrl(returnUrl)) return res.status(503).json({ error: 'Upravljanje naročnine še ni konfigurirano na strežniku.' });
  let portal;
  try {
    portal = await stripeRequest('/billing_portal/sessions', {
      customer: rows[0].stripe_customer_id,
      return_url: returnUrl,
    });
  } catch (e) {
    console.error('Stripe portal:', e.message);
    return res.status(502).json({ error: `Stripe portal ni uspel: ${e.message}` });
  }
  if (!/^https:\/\/billing\.stripe\.com\//.test(portal.url || '')) {
    throw new Error('Stripe ni vrnil veljavnega URL-ja za upravljanje naročnine.');
  }
  res.json({ url: portal.url });
}));

// Profile fields (name/email/color/password) trigger a notification e-mail; plain data sync does not.
app.put('/api/account', auth, wrap(async (req, res) => {
  const b = req.body || {};
  const r = req.acc;
  const changes = [];
  let { name, email, color, client_salt, client_hash, srv_salt, srv_hash } = r;
  if (typeof b.name === 'string' && b.name.trim() !== r.name) {
    const n = b.name.trim().slice(0, 24);
    if (n.length < 2) return res.status(400).json({ error: 'Ime je prekratko.' });
    const d = await pool.query('SELECT 1 FROM accounts WHERE lower(name)=lower($1) AND id<>$2', [n, r.id]);
    if (d.rowCount) return res.status(409).json({ error: 'To ime je že zasedeno.' });
    name = n; changes.push(`uporabniško ime: ${n}`);
  }
  if (typeof b.email === 'string' && b.email.trim().toLowerCase() !== r.email) {
    const m = b.email.trim().toLowerCase();
    if (!EMAIL_RE.test(m)) return res.status(400).json({ error: 'Neveljavna e-pošta.' });
    const d = await pool.query('SELECT 1 FROM accounts WHERE email=$1 AND id<>$2', [m, r.id]);
    if (d.rowCount) return res.status(409).json({ error: 'Ta e-pošta je že registrirana.' });
    email = m; changes.push(`e-pošta: ${m}`);
  }
  if (typeof b.color === 'string' && b.color !== r.color) { color = b.color.slice(0, 16); changes.push('barva profila'); }
  if (b.salt && b.hash) {
    client_salt = str(b.salt, 64); client_hash = str(b.hash, 128);
    srv_salt = crypto.randomBytes(16).toString('hex'); srv_hash = scrypt(client_hash, srv_salt);
    changes.push('geslo');
  }
  const data = b.data && typeof b.data === 'object' ? JSON.stringify(b.data) : null;
  const upd = await pool.query(
    `UPDATE accounts SET name=$1,email=$2,color=$3,client_salt=$4,client_hash=$5,srv_salt=$6,srv_hash=$7,
       data=COALESCE($8::jsonb,data),updated_at=$9 WHERE id=$10 RETURNING updated_at`,
    [name, email, color, client_salt, client_hash, srv_salt, srv_hash, data, Date.now(), r.id]);
  if (changes.length) {
    const text = `Živjo ${name},\n\nTvoj profil je bil posodobljen:\n- ${changes.join('\n- ')}\n\nČe tega nisi naredil ti, takoj zamenjaj geslo.`;
    sendMail(email, 'Profil posodobljen – Gmajna Music', text);
    if (email !== r.email) sendMail(r.email, 'E-pošta profila je bila spremenjena', text);
  }
  res.json({ ok: true, updatedAt: Number(upd.rows[0].updated_at) });
}));

app.delete('/api/account', auth, wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT status FROM billing_subscriptions WHERE account_id=$1', [req.acc.id]);
  if (rows[0]?.status && !['canceled', 'incomplete_expired'].includes(rows[0].status)) {
    return res.status(409).json({ error: 'Pred izbrisom profila prekliči Premium v Stripe portalu in počakaj, da se naročnina zaključi.' });
  }
  await pool.query('DELETE FROM accounts WHERE id=$1', [req.acc.id]);
  sendMail(req.acc.email, 'Profil izbrisan – Gmajna Music', `Živjo ${req.acc.name},\n\nTvoj profil je bil izbrisan.`);
  res.json({ ok: true });
}));

const pubUser = (r) => ({ id: r.id, name: r.name, color: r.color });
const cleanTrack = (t, by) => (t && typeof t === 'object' && /^[\w-]{11}$/.test(str(t.videoId, 11)) ? {
  id: `yt:${t.videoId}`, type: 'yt', videoId: t.videoId, title: str(t.title, 200), artist: str(t.artist, 200),
  cover: /^https:\/\//.test(str(t.cover, 400)) ? t.cover : '', addedBy: by,
} : null);

// ---- Friends ----
app.get('/api/users', auth, wrap(async (req, res) => {
  const q = str(req.query.q, 40).trim().toLowerCase();
  if (q.length < 2) return res.json({ users: [] });
  const { rows } = await pool.query('SELECT id,name,color FROM accounts WHERE lower(name) LIKE $1 AND id<>$2 ORDER BY name LIMIT 10', [`%${q.replace(/[%_]/g, '')}%`, req.acc.id]);
  res.json({ users: rows.map(pubUser) });
}));

app.get('/api/friends', auth, wrap(async (req, res) => {
  const me = req.acc.id;
  const { rows } = await pool.query(
    `SELECT f.requester, f.target, f.status, a.id, a.name, a.color FROM friend_links f
     JOIN accounts a ON a.id = CASE WHEN f.requester=$1 THEN f.target ELSE f.requester END
     WHERE f.requester=$1 OR f.target=$1`, [me]);
  res.json({
    friends: rows.filter((r) => r.status === 'accepted').map(pubUser),
    incoming: rows.filter((r) => r.status === 'pending' && r.target === me).map(pubUser),
    outgoing: rows.filter((r) => r.status === 'pending' && r.requester === me).map(pubUser),
  });
}));

app.post('/api/friends', auth, wrap(async (req, res) => {
  const me = req.acc.id, other = str(req.body?.id, 40);
  if (!other || other === me) return res.status(400).json({ error: 'Neveljaven uporabnik.' });
  const u = await pool.query('SELECT 1 FROM accounts WHERE id=$1', [other]);
  if (!u.rowCount) return res.status(404).json({ error: 'Uporabnik ne obstaja.' });
  const rev = await pool.query('UPDATE friend_links SET status=\'accepted\' WHERE requester=$1 AND target=$2 RETURNING 1', [other, me]);
  if (!rev.rowCount) await pool.query('INSERT INTO friend_links (requester,target,status) VALUES ($1,$2,\'pending\') ON CONFLICT DO NOTHING', [me, other]);
  res.json({ ok: true });
}));

app.post('/api/friends/accept', auth, wrap(async (req, res) => {
  await pool.query('UPDATE friend_links SET status=\'accepted\' WHERE requester=$1 AND target=$2', [str(req.body?.id, 40), req.acc.id]);
  res.json({ ok: true });
}));

app.delete('/api/friends/:id', auth, wrap(async (req, res) => {
  const me = req.acc.id, o = str(req.params.id, 40);
  await pool.query('DELETE FROM friend_links WHERE (requester=$1 AND target=$2) OR (requester=$2 AND target=$1)', [me, o]);
  res.json({ ok: true });
}));

// ---- Shared playlists ----
const collabOut = async (rows) => {
  const ids = [...new Set(rows.flatMap((r) => r.members))];
  const users = ids.length ? (await pool.query('SELECT id,name,color FROM accounts WHERE id = ANY($1)', [ids])).rows : [];
  const byId = new Map(users.map((u) => [u.id, pubUser(u)]));
  return rows.map((r) => ({
    id: r.id, name: r.name, owner: r.owner, tracks: r.tracks, updatedAt: Number(r.updated_at),
    members: r.members.map((m) => byId.get(m)).filter(Boolean),
  }));
};
const getCollab = async (id, me) => {
  const { rows } = await pool.query('SELECT * FROM collabs WHERE id=$1 AND members @> $2::jsonb', [id, JSON.stringify([me])]);
  return rows[0] || null;
};

app.get('/api/collabs', auth, wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM collabs WHERE members @> $1::jsonb', [JSON.stringify([req.acc.id])]);
  res.json({ collabs: await collabOut(rows) });
}));

app.post('/api/collabs', auth, wrap(async (req, res) => {
  const id = crypto.randomBytes(8).toString('hex');
  const tracks = (Array.isArray(req.body?.tracks) ? req.body.tracks : []).map((t) => cleanTrack(t, req.acc.name)).filter(Boolean);
  await pool.query('INSERT INTO collabs (id,name,owner,members,tracks,updated_at) VALUES ($1,$2,$3,$4,$5,$6)',
    [id, str(req.body?.name, 60) || 'Skupni seznam', req.acc.id, JSON.stringify([req.acc.id]), JSON.stringify(tracks), Date.now()]);
  res.json({ id });
}));

app.post('/api/collabs/:id/invite', auth, wrap(async (req, res) => {
  const c = await getCollab(req.params.id, req.acc.id);
  if (!c) return res.status(404).json({ error: 'Seznam ne obstaja.' });
  const uid = str(req.body?.userId, 40);
  const f = await pool.query('SELECT 1 FROM friend_links WHERE status=\'accepted\' AND ((requester=$1 AND target=$2) OR (requester=$2 AND target=$1))', [req.acc.id, uid]);
  if (!f.rowCount) return res.status(403).json({ error: 'Povabiš lahko samo prijatelje.' });
  if (!c.members.includes(uid)) await pool.query('UPDATE collabs SET members=$1::jsonb, updated_at=$2 WHERE id=$3', [JSON.stringify([...c.members, uid].slice(0, 30)), Date.now(), c.id]);
  res.json({ ok: true });
}));

app.post('/api/collabs/:id/tracks', auth, wrap(async (req, res) => {
  const c = await getCollab(req.params.id, req.acc.id);
  if (!c) return res.status(404).json({ error: 'Seznam ne obstaja.' });
  const t = cleanTrack(req.body?.track, req.acc.name);
  if (!t) return res.status(400).json({ error: 'Dodajo se lahko samo YouTube skladbe.' });
  if (!c.tracks.some((x) => x.id === t.id)) {
    await pool.query('UPDATE collabs SET tracks=$1::jsonb, updated_at=$2 WHERE id=$3', [JSON.stringify([...c.tracks, t]), Date.now(), c.id]);
  }
  res.json({ ok: true });
}));

app.delete('/api/collabs/:id/tracks', auth, wrap(async (req, res) => {
  const c = await getCollab(req.params.id, req.acc.id);
  if (!c) return res.status(404).json({ error: 'Seznam ne obstaja.' });
  const tid = str(req.query.trackId, 40);
  await pool.query('UPDATE collabs SET tracks=$1::jsonb, updated_at=$2 WHERE id=$3', [JSON.stringify(c.tracks.filter((x) => x.id !== tid)), Date.now(), c.id]);
  res.json({ ok: true });
}));

app.delete('/api/collabs/:id', auth, wrap(async (req, res) => {
  const c = await getCollab(req.params.id, req.acc.id);
  if (!c) return res.json({ ok: true });
  const rest = c.members.filter((m) => m !== req.acc.id);
  if (!rest.length) await pool.query('DELETE FROM collabs WHERE id=$1', [c.id]);
  else await pool.query('UPDATE collabs SET members=$1::jsonb, owner=$2, updated_at=$3 WHERE id=$4', [JSON.stringify(rest), rest.includes(c.owner) ? c.owner : rest[0], Date.now(), c.id]);
  res.json({ ok: true });
}));

// ---- Password reset (6-digit code by e-mail, valid 15 min) ----
app.post('/api/reset/request', wrap(async (req, res) => {
  if (!mailer && !process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: 'Pošiljanje e-pošte ni nastavljeno. Nastavi Resend (RESEND_API_KEY, MAIL_FROM) ali SMTP.' });
  }
  const key = str(req.body?.key, 120).trim().toLowerCase();
  const { rows } = await pool.query('SELECT id,name,email FROM accounts WHERE email=$1 OR lower(name)=$1', [key]);
  const r = rows[0];
  if (r) {
    const code = String(crypto.randomInt(100000, 1000000));
    const sent = await sendMail(r.email, 'Reset gesla – Rythmify', `Živjo ${r.name},\n\nKoda za ponastavitev gesla: ${code}\nVeljavna je 15 minut. Če je nisi zahteval ti, tega sporočila ne upoštevaj.`);
    if (!sent) return res.status(502).json({ error: 'E-pošte ni bilo mogoče poslati. Preveri Resend/SMTP nastavitve in MAIL_FROM.' });
    await pool.query(
      `INSERT INTO password_resets (account_id,code_hash,expires_at,attempts)
       VALUES ($1,$2,$3,0)
       ON CONFLICT (account_id) DO UPDATE SET code_hash=$2,expires_at=$3,attempts=0`,
      [r.id, sha(code), Date.now() + 15 * 60000]);
  }
  res.json({ ok: true });
}));

app.post('/api/reset/confirm', wrap(async (req, res) => {
  const b = req.body || {};
  const key = str(b.key, 120).trim().toLowerCase();
  const { rows } = await pool.query('SELECT id,name,email FROM accounts WHERE email=$1 OR lower(name)=$1', [key]);
  const r = rows[0];
  const salt = str(b.salt, 64), hash = str(b.hash, 128);
  if (!salt || !hash) return res.status(400).json({ error: 'Neveljavni podatki.' });
  const srvSalt = crypto.randomBytes(16).toString('hex');
  if (!r) return res.status(400).json({ error: 'Napačna ali potekla koda.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: resetRows } = await client.query('SELECT * FROM password_resets WHERE account_id=$1 FOR UPDATE', [r.id]);
    const reset = resetRows[0];
    if (!reset || Number(reset.expires_at) < Date.now() || reset.attempts >= 5) {
      await client.query('DELETE FROM password_resets WHERE account_id=$1', [r.id]);
      await client.query('COMMIT');
      return res.status(400).json({ error: 'Napačna ali potekla koda.' });
    }
    if (reset.code_hash !== sha(str(b.code, 12).trim())) {
      await client.query('UPDATE password_resets SET attempts=attempts+1 WHERE account_id=$1', [r.id]);
      await client.query('COMMIT');
      return res.status(400).json({ error: 'Napačna ali potekla koda.' });
    }
    await client.query(
      'UPDATE accounts SET client_salt=$1,client_hash=$2,srv_salt=$3,srv_hash=$4,token_hash=NULL WHERE id=$5',
      [salt, hash, srvSalt, scrypt(hash, srvSalt), r.id]);
    await client.query('DELETE FROM password_resets WHERE account_id=$1', [r.id]);
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error('Reset transaction rollback failed:', rollbackError.message); }
    throw e;
  } finally {
    client.release();
  }
  await sendMail(r.email, 'Geslo spremenjeno – Rythmify', `Živjo ${r.name},\n\nTvoje geslo je bilo spremenjeno. Če tega nisi naredil ti, nas kontaktiraj.`);
  res.json({ ok: true });
}));

(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS accounts (
    id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, color text,
    client_salt text NOT NULL, client_hash text NOT NULL, srv_salt text NOT NULL, srv_hash text NOT NULL,
    token_hash text, data jsonb NOT NULL DEFAULT '{}', updated_at bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now())`);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS accounts_name_idx ON accounts (lower(name))');
  await pool.query(`CREATE TABLE IF NOT EXISTS billing_subscriptions (
    account_id text PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    stripe_customer_id text UNIQUE,
    stripe_subscription_id text UNIQUE,
    status text NOT NULL DEFAULT 'incomplete',
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    current_period_end bigint NOT NULL DEFAULT 0,
    updated_at bigint NOT NULL DEFAULT 0
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS friend_links (requester text NOT NULL, target text NOT NULL, status text NOT NULL, PRIMARY KEY (requester, target))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS collabs (id text PRIMARY KEY, name text NOT NULL, owner text NOT NULL,
    members jsonb NOT NULL DEFAULT '[]', tracks jsonb NOT NULL DEFAULT '[]', updated_at bigint NOT NULL DEFAULT 0)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS password_resets (
    account_id text PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    code_hash text NOT NULL, expires_at bigint NOT NULL, attempts integer NOT NULL DEFAULT 0
  )`);
  httpServer.listen(PORT, () => console.log('Rythmify account and Jam server listening on', PORT));
})();

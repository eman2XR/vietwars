// Web Push for the Home Screen app: the loop on this Mac sends a notification when an issue is published or a question
// is answered. No dependencies: Node's crypto does the VAPID signing (RFC 8292) and payload encryption (RFC 8291).
//
//   node scripts/push.mjs init                       create the keys (.push/keys.json, never committed) and web/push.json
//   node scripts/push.mjs inbox                      save new subscriptions posted by the app as GitHub issues, and welcome them
//   node scripts/push.mjs send --title T --body B [--url "#/lesson/lesson-04"] [--tag T]
//   node scripts/push.mjs status                     how many devices are subscribed
//
// A device subscribes from Settings in the app. It posts its subscription as a GitHub issue, sealed with the inbox key
// in web/push.json, so the public repository never shows it. The private keys stay in .push/keys.json on this Mac; if
// they are lost, run init again, publish the new web/push.json, and turn notifications on again on each device.

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = `${ROOT}.push`;
const KEYS = `${DIR}/keys.json`;
const SUBS = `${DIR}/subscriptions.json`;
const PUBLIC_FILE = `${ROOT}web/push.json`;
const REPO = 'eman2XR/vietwars';
const SITE = 'https://eman2xr.github.io/vietwars/';
export const PUSH_MARKER = '<!-- vietwars-push -->';
export const INBOX_INFO = 'vietwars inbox v1';

export const b64u = (buf) => Buffer.from(buf).toString('base64url');
export const unb64u = (s) => Buffer.from(String(s), 'base64url');

function keyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const pub = publicKey.export({ format: 'jwk' });
  return { jwk, public: b64u(Buffer.concat([Buffer.from([4]), unb64u(pub.x), unb64u(pub.y)])) };
}

// Signs the VAPID token that proves the push comes from the holder of the key the device subscribed with.
export function vapidAuthorization(endpoint, vapid, subject = SITE, now = Math.floor(Date.now() / 1000)) {
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: now + 12 * 3600, sub: subject }));
  const key = crypto.createPrivateKey({ key: vapid.jwk, format: 'jwk' });
  const signature = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64u(signature)}, k=${vapid.public}`;
}

// Encrypts a payload for one subscription as a single aes128gcm record (RFC 8291). The ephemeral key and salt can be
// passed in for tests.
export function encryptPayload(plaintext, keys, { ephemeral, salt = crypto.randomBytes(16), recordSize = 4096 } = {}) {
  const uaPublic = unb64u(keys.p256dh);
  const authSecret = unb64u(keys.auth);
  const ecdh = crypto.createECDH('prime256v1');
  if (ephemeral) ecdh.setPrivateKey(ephemeral);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(uaPublic);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', secret, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const record = Buffer.concat([Buffer.from(plaintext), Buffer.from([2])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);
  const head = Buffer.alloc(21);
  salt.copy(head, 0);
  head.writeUInt32BE(recordSize, 16);
  head.writeUInt8(asPublic.length, 20);
  return Buffer.concat([head, asPublic, body]);
}

// Opens a subscription sealed by the app (web/js/push.js): ECDH with the inbox key, HKDF, then AES-256-GCM.
export function unseal(sealed, inbox) {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(unb64u(inbox.jwk.d));
  const secret = ecdh.computeSecret(unb64u(sealed.epk));
  const key = Buffer.from(crypto.hkdfSync('sha256', secret, unb64u(sealed.salt), Buffer.from(INBOX_INFO), 32));
  const data = unb64u(sealed.ct);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, unb64u(sealed.iv));
  decipher.setAuthTag(data.subarray(data.length - 16));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]).toString('utf8'));
}

function loadKeys() {
  if (!existsSync(KEYS)) throw new Error('no keys: run `node scripts/push.mjs init` first');
  return JSON.parse(readFileSync(KEYS, 'utf8'));
}

function loadSubs() {
  return existsSync(SUBS) ? JSON.parse(readFileSync(SUBS, 'utf8')) : [];
}

function saveSubs(subs) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(SUBS, `${JSON.stringify(subs, null, 1)}\n`, { mode: 0o600 });
}

export async function sendOne(sub, message, keys) {
  const body = encryptPayload(JSON.stringify(message), sub.keys);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidAuthorization(sub.endpoint, keys.vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(4 * 24 * 3600),
      Urgency: 'normal',
    },
    body,
  });
  return res.status;
}

async function send(message) {
  const keys = loadKeys();
  const subs = loadSubs();
  if (!subs.length) {
    console.log('no subscribed devices');
    return 0;
  }
  const keep = [];
  let sent = 0;
  for (const sub of subs) {
    let status;
    try {
      status = await sendOne(sub, message, keys);
    } catch (err) {
      console.log(`${sub.device || 'device'}: ${err.message}`);
      keep.push(sub);
      continue;
    }
    if (status === 404 || status === 410) {
      console.log(`${sub.device || 'device'}: subscription gone (${status}), removed`);
      continue;
    }
    keep.push(sub);
    if (status >= 200 && status < 300) sent += 1;
    else console.log(`${sub.device || 'device'}: push service answered ${status}`);
  }
  saveSubs(keep);
  console.log(`sent to ${sent} of ${subs.length} device(s)`);
  return sent;
}

function gh(args, input) {
  return execFileSync('gh', args, { encoding: 'utf8', input, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
}

async function inbox() {
  const keys = loadKeys();
  const issues = JSON.parse(gh(['issue', 'list', '-R', REPO, '--state', 'open', '--limit', '100', '--json', 'number,body']));
  const subs = loadSubs();
  let added = 0;
  for (const issue of issues) {
    const body = issue.body || '';
    if (!body.includes(PUSH_MARKER)) continue;
    const m = body.match(/```json\s*([\s\S]*?)\s*```/);
    let note = 'Could not read this request.';
    try {
      const req = JSON.parse(m[1]);
      const sub = unseal(req.sealed, keys.inbox);
      if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('incomplete subscription');
      const fresh = !subs.some((s) => s.endpoint === sub.endpoint);
      const entry = { endpoint: sub.endpoint, keys: sub.keys, device: req.device || null, at: req.at || new Date().toISOString() };
      if (fresh) subs.push(entry);
      saveSubs(subs);
      const status = await sendOne(entry, { title: 'Notifications are on', body: 'You will hear from Học tiếng Việt when a new issue is ready or a question has an answer.', url: './', tag: 'welcome' }, keys);
      note = status >= 200 && status < 300 ? 'Saved on the editors\' Mac; a welcome notification was sent.' : `Saved, but the push service answered ${status} to the welcome notification.`;
      if (fresh) added += 1;
    } catch (err) {
      note = `Could not use this request (${err.message}). Turn notifications off and on again in the app's Settings.`;
    }
    gh(['issue', 'close', String(issue.number), '-R', REPO, '--comment', note]);
    console.log(`#${issue.number}: ${note}`);
  }
  console.log(`${added} new device(s), ${subs.length} in total`);
}

function init() {
  if (existsSync(KEYS)) throw new Error('.push/keys.json exists; delete it first to make new keys (every device must then subscribe again)');
  const keys = { vapid: keyPair(), inbox: keyPair(), created: new Date().toISOString() };
  mkdirSync(DIR, { recursive: true });
  writeFileSync(KEYS, `${JSON.stringify(keys, null, 1)}\n`, { mode: 0o600 });
  writeFileSync(PUBLIC_FILE, `${JSON.stringify({ vapid: keys.vapid.public, inbox: keys.inbox.public }, null, 1)}\n`);
  console.log('wrote .push/keys.json (private, never commit it) and web/push.json (public)');
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'init') return init();
  if (cmd === 'inbox') return inbox();
  if (cmd === 'status') return console.log(`${loadSubs().length} device(s) subscribed; keys ${existsSync(KEYS) ? 'present' : 'missing'}`);
  if (cmd === 'send') {
    const title = arg('title');
    if (!title) throw new Error('send needs --title');
    return send({ title, body: arg('body') || '', url: arg('url') || './', tag: arg('tag') || 'vietwars' });
  }
  console.log('usage: node scripts/push.mjs init | inbox | send --title T --body B [--url U] [--tag T] | status');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(`error: ${err.message}`);
    process.exit(1);
  });
}

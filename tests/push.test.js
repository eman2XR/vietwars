import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { encryptPayload, vapidAuthorization, unseal, b64u, unb64u } from '../scripts/push.mjs';
import { seal } from '../web/js/push.js';

function pair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const pub = publicKey.export({ format: 'jwk' });
  return { jwk, public: b64u(Buffer.concat([Buffer.from([4]), unb64u(pub.x), unb64u(pub.y)])) };
}

// Decrypts a push message the way a browser does (RFC 8291 with RFC 8188 aes128gcm).
function browserDecrypt(message, uaPrivate, uaPublic, authSecret) {
  const salt = message.subarray(0, 16);
  const idlen = message.readUInt8(20);
  const asPublic = message.subarray(21, 21 + idlen);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(uaPrivate);
  const secret = ecdh.computeSecret(asPublic);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', secret, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const body = message.subarray(21 + idlen);
  const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(body.subarray(body.length - 16));
  const record = Buffer.concat([decipher.update(body.subarray(0, body.length - 16)), decipher.final()]);
  let end = record.length - 1;
  while (end >= 0 && record[end] === 0) end -= 1;
  assert.equal(record[end], 2, 'the last record ends with the 0x02 delimiter');
  return { text: record.subarray(0, end).toString('utf8'), rs: message.readUInt32BE(16), idlen };
}

test('a push payload decrypts the way a browser decrypts it', () => {
  const ua = crypto.createECDH('prime256v1');
  ua.generateKeys();
  const auth = crypto.randomBytes(16);
  const message = JSON.stringify({ title: 'Issue 4 is ready', body: 'Phố cổ', url: '#/lesson/lesson-04' });
  const out = encryptPayload(message, { p256dh: b64u(ua.getPublicKey()), auth: b64u(auth) });
  const got = browserDecrypt(out, ua.getPrivateKey(), ua.getPublicKey(), auth);
  assert.equal(got.text, message);
  assert.equal(got.rs, 4096);
  assert.equal(got.idlen, 65);
  assert.ok(out.length < 4096, 'fits the push services\' size limit');
});

test('the VAPID token is signed with the subscribed key and names the push service', () => {
  const vapid = pair();
  const header = vapidAuthorization('https://web.push.apple.com/QGuQyavXutnMH6Ix', vapid, 'https://eman2xr.github.io/vietwars/', 1_800_000_000);
  const m = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
  assert.ok(m, header);
  assert.equal(m[4], vapid.public);
  const claims = JSON.parse(unb64u(m[2]).toString('utf8'));
  assert.equal(claims.aud, 'https://web.push.apple.com');
  assert.equal(claims.exp, 1_800_000_000 + 12 * 3600);
  assert.equal(claims.sub, 'https://eman2xr.github.io/vietwars/');
  const raw = unb64u(vapid.public);
  const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(raw.subarray(1, 33)), y: b64u(raw.subarray(33)) }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(`${m[1]}.${m[2]}`), { key, dsaEncoding: 'ieee-p1363' }, unb64u(m[3])));
});

test('a subscription sealed by the app opens only with the inbox key', async () => {
  const inbox = pair();
  const sub = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'BKx', auth: 'q1w2' } };
  const sealed = await seal(sub, inbox.public, crypto.webcrypto.subtle);
  assert.deepEqual(unseal(sealed, inbox), sub);
  assert.throws(() => unseal(sealed, pair()));
  assert.ok(!JSON.stringify(sealed).includes('web.push.apple.com'), 'the endpoint is not readable in the issue');
});

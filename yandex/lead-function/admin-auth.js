'use strict';

const { createHmac, randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');

const SESSION_SECONDS = 30 * 24 * 60 * 60;

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function decodeJson(value) {
  try { return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); } catch { return null; }
}

function configured(env) {
  return Boolean(env.ADMIN_PASSWORD_SCRYPT?.trim() && env.ADMIN_SESSION_SECRET?.trim());
}

function passwordMatches(password, encoded) {
  const [algorithm, nText, rText, pText, saltText, expectedText] = String(encoded || '').split('$');
  if (algorithm !== 'scrypt' || !password || !saltText || !expectedText) return false;
  const N = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || N < 16384 || r < 8 || p < 1) return false;
  let expected;
  try { expected = Buffer.from(expectedText, 'base64url'); } catch { return false; }
  if (expected.length !== 32) return false;
  const actual = scryptSync(password, Buffer.from(saltText, 'base64url'), expected.length, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(actual, expected);
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function createSession(secret, now = Date.now()) {
  const payload = base64url(JSON.stringify({
    v: 1,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + SESSION_SECONDS,
    nonce: randomBytes(12).toString('base64url'),
  }));
  return `${payload}.${sign(payload, secret)}`;
}

function verifySession(token, secret, now = Date.now()) {
  if (!token || !secret) return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  const expected = sign(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return false;
  const session = decodeJson(payload);
  return Boolean(session?.v === 1 && Number.isInteger(session.exp) && session.exp > Math.floor(now / 1000));
}

function isAuthorized(headers, env, now = Date.now()) {
  return configured(env) && verifySession(headers['x-admin-session'], env.ADMIN_SESSION_SECRET.trim(), now);
}

module.exports = {
  SESSION_SECONDS,
  configured,
  createSession,
  isAuthorized,
  passwordMatches,
  verifySession,
};

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, scryptSync } = require('node:crypto');
const {
  createSession,
  isAuthorized,
  passwordMatches,
  verifySession,
} = require('./admin-auth.js');

function hash(password) {
  const salt = randomBytes(16);
  const expected = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${expected.toString('base64url')}`;
}

test('scrypt password verification rejects incorrect values', () => {
  const encoded = hash('a strong test password');
  assert.equal(passwordMatches('a strong test password', encoded), true);
  assert.equal(passwordMatches('wrong password', encoded), false);
  assert.equal(passwordMatches('', encoded), false);
});

test('signed admin sessions expire and reject tampering', () => {
  const secret = 'test-session-secret-with-at-least-32-characters';
  const now = Date.parse('2026-09-11T12:00:00.000Z');
  const token = createSession(secret, now);
  assert.equal(verifySession(token, secret, now + 1000), true);
  assert.equal(verifySession(token + 'x', secret, now + 1000), false);
  assert.equal(verifySession(token, 'another-secret', now + 1000), false);
  assert.equal(verifySession(token, secret, now + 89 * 24 * 60 * 60 * 1000), true);
  assert.equal(verifySession(token, secret, now + 91 * 24 * 60 * 60 * 1000), false);
});

test('admin authorization uses a custom session header supported by Yandex Functions', () => {
  const secret = 'test-session-secret-with-at-least-32-characters';
  const env = { ADMIN_PASSWORD_SCRYPT: 'configured', ADMIN_SESSION_SECRET: secret };
  const token = createSession(secret);
  assert.equal(isAuthorized({ 'x-admin-session': token }, env), true);
  assert.equal(isAuthorized({ cookie: `photoprobiz_admin=${token}` }, env), false);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('./index.js');
const env = { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: 'test-chat' };
const lead = { name: 'Тест', contact: '+79990000000', contactMethod: 'phone', consent: true, source: 'modal', phoneCountry: 'RU' };
const event = (payload = lead) => ({ httpMethod: 'POST', headers: { Origin: 'https://photoprobiz.ru', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const success = async () => ({ ok: true, json: async () => ({ ok: true }) });

test('health works without credentials and does not expose secrets', async () => {
  const result = await createHandler({ env })({ httpMethod: 'GET' });
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).telegramConfigured, true);
  assert.ok(!result.body.includes('test-token'));
});
test('preflight handles case-insensitive headers and allowed origins', async () => {
  const result = await createHandler()({ ...event(), httpMethod: 'OPTIONS' });
  assert.equal(result.statusCode, 204);
  assert.equal(result.headers['Access-Control-Allow-Origin'], 'https://photoprobiz.ru');
});
test('untrusted and missing origins cannot submit', async () => {
  const handler = createHandler({ env, fetchImpl: () => assert.fail('must not send') });
  for (const origin of [undefined, 'https://example.org']) {
    const result = await handler({ ...event(), headers: { origin } });
    assert.equal(result.statusCode, 403);
    assert.equal(result.headers['Access-Control-Allow-Origin'], undefined);
  }
});
test('all form sources, messengers and packages preserve phone and message fields', async () => {
  for (const source of ['inline', 'modal']) for (const contactMethod of ['phone', 'telegram', 'whatsapp', 'max_messenger']) for (const packageName of [undefined, 'Минимальный', 'Базовый', 'Полный']) {
    const handler = createHandler({ env, fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.telegram.org/bottest-token/sendMessage');
      const body = JSON.parse(options.body);
      assert.equal(body.chat_id, env.TELEGRAM_CHAT_ID);
      assert.ok(body.text.includes(lead.contact));
      if (packageName) assert.ok(body.text.includes(packageName));
      return success();
    } });
    assert.equal((await handler(event({ ...lead, source, contactMethod, packageName }))).statusCode, 200);
  }
});
test('invalid lead data does not reach Telegram', async () => {
  const handler = createHandler({ env, fetchImpl: () => assert.fail('must not send') });
  for (const patch of [{ consent: false }, { contact: '@username' }, { contactMethod: 'toString' }, { name: '' }, { name: 'Тест\nПодмена' }, { source: 'unknown' }, { packageName: 'other' }]) assert.equal((await handler(event({ ...lead, ...patch }))).statusCode, 400);
});
test('rejects malformed JSON, large payload, unsupported media and method', async () => {
  const handler = createHandler();
  assert.equal((await handler({ ...event(), body: '{' })).statusCode, 400);
  assert.equal((await handler({ ...event(), body: 'x'.repeat(9000) })).statusCode, 413);
  assert.equal((await handler({ ...event(), headers: { origin: 'https://photoprobiz.ru', 'content-type': 'text/plain' } })).statusCode, 415);
  assert.equal((await handler({ ...event(), httpMethod: 'DELETE' })).statusCode, 405);
});
test('decodes base64 Yandex events', async () => {
  const result = await createHandler({ env, fetchImpl: success })({ ...event(), isBase64Encoded: true, body: Buffer.from(JSON.stringify(lead)).toString('base64') });
  assert.equal(result.statusCode, 200);
});
test('missing secrets return an explicit failure', async () => {
  assert.equal((await createHandler({ env: {} })(event())).statusCode, 503);
});
test('Telegram HTTP errors and API rejection never report success', async () => {
  for (const response of [{ ok: false, json: async () => ({ ok: false }) }, { ok: true, json: async () => ({ ok: false }) }, { ok: true, json: async () => { throw Error('invalid response'); } }]) {
    const result = await createHandler({ env, fetchImpl: async () => response })(event());
    assert.equal(result.statusCode, 502);
  }
});
test('network failures and timeouts return errors without disclosing secrets', async () => {
  const failed = await createHandler({ env, fetchImpl: async () => { throw Error(env.TELEGRAM_BOT_TOKEN); } })(event());
  assert.equal(failed.statusCode, 502);
  assert.ok(!failed.body.includes(env.TELEGRAM_BOT_TOKEN));
  const timedOut = await createHandler({ env, telegramTimeoutMs: 5, fetchImpl: (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Error('aborted')), { once: true })) })(event());
  assert.equal(timedOut.statusCode, 504);
});
test('relay sends validated lead only to existing backend, without Telegram secrets', async () => {
  let calls = 0;
  const handler = createHandler({ env: { ...env, DELIVERY_MODE: 'cloudflare-relay' }, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.photoprobiz.ru/lead');
    assert.equal(options.headers.Origin, 'https://photoprobiz.ru');
    assert.deepEqual(JSON.parse(options.body), lead);
    assert.ok(!JSON.stringify(options).includes(env.TELEGRAM_BOT_TOKEN));
    return success();
  } });
  assert.equal((await handler(event())).statusCode, 200);
  assert.equal(calls, 1);
});
test('relay does not falsely succeed or retry on upstream failure', async () => {
  for (const fetchImpl of [async () => ({ ok: true, json: async () => ({}) }), async () => { throw Error('network'); }]) {
    let calls = 0;
    const handler = createHandler({ env: { DELIVERY_MODE: 'cloudflare-relay' }, fetchImpl: (...args) => { calls++; return fetchImpl(...args); } });
    assert.equal((await handler(event())).statusCode, 502);
    assert.equal(calls, 1);
  }
});

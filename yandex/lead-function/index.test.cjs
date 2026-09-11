const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, scryptSync } = require('node:crypto');
const { createHandler } = require('./index.js');
const { CONSENT_COLUMNS, CONSENT_TABLE, LEADS_COLUMNS, LEADS_TABLE, UPSERT_LEAD, createYdbStore, storageRecord } = require('./storage.js');

const env = {
  ENDPOINT: 'grpcs://example.test:2135', DATABASE: '/test/database',
  TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: 'test-chat', RELAY_TOKEN: 'relay-test-token',
};
const lead = {
  name: 'Тест', contact: '+79990000000', contactMethod: 'phone', consent: true, source: 'modal', phoneCountry: 'RU',
  consentAcceptedAt: '2026-09-11T10:00:00.000Z', consentVersion: '2026-09-11',
  submissionId: '019a1234-5678-7000-8000-123456789abc', formId: 'modal-general',
};
const event = (payload = lead) => ({ httpMethod: 'POST', headers: { Origin: 'https://photoprobiz.ru', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const success = async () => ({ ok: true, json: async () => ({ ok: true }) });
const saved = () => ({ databaseConfigured: () => true, save: async () => {} });
const handler = (options = {}) => createHandler({ env, leadStore: saved(), ...options });
const context = { token: { access_token: 'test-function-iam-token' } };

function passwordHash(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

test('health works without connecting and exposes only configuration state', async () => {
  const result = await handler()({ httpMethod: 'GET' });
  const body = JSON.parse(result.body);
  assert.equal(result.statusCode, 200);
  assert.equal(body.storage, 'ydb');
  assert.equal(body.databaseConfigured, true);
  assert.equal(body.telegramConfigured, true);
  assert.ok(!result.body.includes('test-token'));
});

test('admin page is public shell but lead data requires a signed session', async () => {
  const adminEnv = {
    ...env,
    ADMIN_BASE_URL: 'https://functions.yandexcloud.net/test-function-id',
    ADMIN_PASSWORD_SCRYPT: passwordHash('correct horse battery staple'),
    ADMIN_SESSION_SECRET: 'test-admin-session-secret-with-at-least-32-characters',
  };
  const row = {
    submission_id: lead.submissionId,
    server_received_at: new Date('2026-09-11T12:00:00.000Z'),
    consent_accepted_at: new Date(lead.consentAcceptedAt),
    consent_version: lead.consentVersion,
    form_id: lead.formId,
    source: lead.source,
    site_host: 'photoprobiz.ru',
    name: lead.name,
    phone: lead.contact,
    contact_method: lead.contactMethod,
    package_name: '',
    phone_country: 'RU',
    status: 'new',
    expires_at: new Date('2027-09-11T12:00:00.000Z'),
  };
  const statusUpdates = [];
  const leadStore = {
    databaseConfigured: () => true,
    list: async (_token, options) => {
      assert.equal(options.limit, 50);
      return { rows: [row], hasMore: false };
    },
    get: async (id) => id === lead.submissionId ? row : null,
    updateStatus: async (id, status) => statusUpdates.push({ id, status }),
  };
  const instance = createHandler({ env: adminEnv, leadStore });
  const page = await instance({ httpMethod: 'GET', queryStringParameters: { admin: '1' }, headers: {} }, context);
  assert.equal(page.statusCode, 200);
  assert.match(page.headers['Content-Type'], /text\/html/);
  assert.ok(page.body.includes('личный кабинет'));
  assert.ok(!page.body.includes(lead.contact));

  const unauthorized = await instance({ httpMethod: 'GET', queryStringParameters: { admin_api: 'leads' }, headers: {} }, context);
  assert.equal(unauthorized.statusCode, 401);

  const wrong = await instance({
    httpMethod: 'POST', queryStringParameters: { admin_api: 'login' },
    headers: { Origin: 'https://functions.yandexcloud.net' }, body: JSON.stringify({ password: 'wrong' }),
  }, context);
  assert.equal(wrong.statusCode, 401);

  const loggedIn = await instance({
    httpMethod: 'POST', queryStringParameters: { admin_api: 'login' },
    headers: { Origin: 'https://functions.yandexcloud.net' }, body: JSON.stringify({ password: 'correct horse battery staple' }),
  }, context);
  assert.equal(loggedIn.statusCode, 200);
  const session = JSON.parse(loggedIn.body).session;
  assert.equal(typeof session, 'string');
  assert.ok(session.length > 40);

  const listed = await instance({
    httpMethod: 'GET', queryStringParameters: { admin_api: 'leads', limit: '50' }, headers: { 'X-Admin-Session': session },
  }, context);
  assert.equal(listed.statusCode, 200);
  const listedBody = JSON.parse(listed.body);
  assert.equal(listedBody.leads[0].name, lead.name);
  assert.equal(listedBody.leads[0].phone, lead.contact);
  assert.equal(listedBody.leads[0].serverReceivedAt, '2026-09-11T12:00:00.000Z');

  const updated = await instance({
    httpMethod: 'POST', queryStringParameters: { admin_api: 'status' },
    headers: { 'X-Admin-Session': session, Origin: 'https://functions.yandexcloud.net' },
    body: JSON.stringify({ submissionId: lead.submissionId, status: 'contacted' }),
  }, context);
  assert.equal(updated.statusCode, 200);
  assert.deepEqual(statusUpdates, [{ id: lead.submissionId, status: 'contacted' }]);
});

test('preflight handles case-insensitive headers and allowed origins', async () => {
  const result = await handler()({ ...event(), httpMethod: 'OPTIONS' });
  assert.equal(result.statusCode, 204);
  assert.equal(result.headers['Access-Control-Allow-Origin'], 'https://photoprobiz.ru');
});

test('untrusted and missing origins cannot submit or write', async () => {
  const leadStore = { databaseConfigured: () => true, save: () => assert.fail('must not store') };
  const instance = createHandler({ env, leadStore, fetchImpl: () => assert.fail('must not send') });
  for (const origin of [undefined, 'https://example.org']) {
    const result = await instance({ ...event(), headers: { origin } });
    assert.equal(result.statusCode, 403);
    assert.equal(result.headers['Access-Control-Allow-Origin'], undefined);
  }
});

test('all forms and contact choices are stored before an anonymous Telegram notification', async () => {
  for (const source of ['inline', 'modal']) for (const contactMethod of ['phone', 'telegram', 'whatsapp', 'max_messenger']) for (const packageName of [undefined, 'Минимальный', 'Базовый', 'Полный']) {
    const order = [];
    const leadStore = { databaseConfigured: () => true, save: async (stored, _receivedAt, accessToken) => {
      order.push('store');
      assert.equal(stored.contact, lead.contact);
      assert.equal(accessToken, context.token.access_token);
    } };
    const instance = createHandler({ env, leadStore, fetchImpl: async (url, options) => {
      order.push('notify');
      assert.equal(url, 'https://api.telegram.org/bottest-token/sendMessage');
      const body = JSON.parse(options.body);
      assert.equal(body.chat_id, env.TELEGRAM_CHAT_ID);
      assert.ok(body.text.includes(lead.submissionId));
      assert.ok(!body.text.includes(lead.name));
      assert.ok(!body.text.includes(lead.contact));
      return success();
    } });
    assert.equal((await instance(event({ ...lead, source, contactMethod, packageName }), context)).statusCode, 200);
    assert.deepEqual(order, ['store', 'notify']);
  }
});

test('invalid lead data does not reach YDB or Telegram', async () => {
  const leadStore = { databaseConfigured: () => true, save: () => assert.fail('must not store') };
  const instance = createHandler({ env, leadStore, fetchImpl: () => assert.fail('must not send') });
  for (const patch of [
    { consent: false }, { contact: '@username' }, { contactMethod: 'toString' }, { name: '' },
    { name: 'Тест\nПодмена' }, { source: 'unknown' }, { packageName: 'other' },
    { consentAcceptedAt: 'not-a-date' }, { consentVersion: 'legacy' }, { submissionId: '' }, { formId: 'unknown' },
  ]) assert.equal((await instance(event({ ...lead, ...patch }))).statusCode, 400);
});

test('rejects malformed JSON, large payload, unsupported media and method', async () => {
  const instance = handler();
  assert.equal((await instance({ ...event(), body: '{' })).statusCode, 400);
  assert.equal((await instance({ ...event(), body: 'x'.repeat(9000) })).statusCode, 413);
  assert.equal((await instance({ ...event(), headers: { origin: 'https://photoprobiz.ru', 'content-type': 'text/plain' } })).statusCode, 415);
  assert.equal((await instance({ ...event(), httpMethod: 'DELETE' })).statusCode, 405);
});

test('decodes base64 Yandex events', async () => {
  const result = await handler({ fetchImpl: success })({ ...event(), isBase64Encoded: true, body: Buffer.from(JSON.stringify(lead)).toString('base64') });
  assert.equal(result.statusCode, 200);
});

test('a storage failure prevents notification and success', async () => {
  const leadStore = { databaseConfigured: () => true, save: async () => { throw Error('private database error'); } };
  const result = await createHandler({ env, leadStore, fetchImpl: () => assert.fail('must not send') })(event(), context);
  assert.equal(result.statusCode, 502);
  assert.equal(JSON.parse(result.body).code, 'DATABASE_WRITE_FAILED');
  assert.ok(!result.body.includes('private database error'));
});

test('relay receives only anonymous metadata and a shared secret after storage', async () => {
  const order = [];
  const leadStore = { databaseConfigured: () => true, save: async () => { order.push('store'); } };
  const instance = createHandler({ env: { ...env, DELIVERY_MODE: 'cloudflare-relay' }, leadStore, fetchImpl: async (url, options) => {
    order.push('relay');
    assert.equal(url, 'https://api.photoprobiz.ru/lead');
    assert.equal(options.headers.Origin, 'https://photoprobiz.ru');
    assert.equal(options.headers['X-Relay-Token'], env.RELAY_TOKEN);
    const relayed = JSON.parse(options.body);
    assert.deepEqual(Object.keys(relayed).sort(), ['event', 'serverReceivedAt', 'site', 'submissionId']);
    assert.equal(relayed.event, 'new_lead');
    assert.equal(relayed.site, 'photoprobiz.ru');
    assert.equal(relayed.submissionId, lead.submissionId);
    assert.ok(!JSON.stringify(options).includes(lead.name));
    assert.ok(!JSON.stringify(options).includes(lead.contact));
    assert.ok(!options.body.includes(env.TELEGRAM_BOT_TOKEN));
    return success();
  } });
  assert.equal((await instance(event(), context)).statusCode, 200);
  assert.deepEqual(order, ['store', 'relay']);
});

test('missing relay secret and delivery failures are explicit', async () => {
  const withoutSecret = await createHandler({ env: { DELIVERY_MODE: 'cloudflare-relay' }, leadStore: saved() })(event(), context);
  assert.equal(withoutSecret.statusCode, 503);
  assert.equal(JSON.parse(withoutSecret.body).code, 'RELAY_NOT_CONFIGURED');
  for (const fetchImpl of [async () => ({ ok: true, json: async () => ({}) }), async () => { throw Error('network'); }]) {
    let calls = 0;
    const instance = handler({ env: { ...env, DELIVERY_MODE: 'cloudflare-relay' }, fetchImpl: (...args) => { calls += 1; return fetchImpl(...args); } });
    assert.equal((await instance(event(), context)).statusCode, 502);
    assert.equal(calls, 1);
  }
});

test('network timeouts return errors without disclosing secrets', async () => {
  const timedOut = await handler({ telegramTimeoutMs: 5, fetchImpl: (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Error('aborted')), { once: true })) })(event(), context);
  assert.equal(timedOut.statusCode, 504);
  assert.ok(!timedOut.body.includes(env.TELEGRAM_BOT_TOKEN));
});

test('storage records use separate one-year and three-year expirations', () => {
  const record = storageRecord(lead, '2026-09-11T12:00:00.000Z');
  assert.equal(record.leadExpiresAt.toISOString(), '2027-09-11T12:00:00.000Z');
  assert.equal(record.consentExpiresAt.toISOString(), '2029-09-11T12:00:00.000Z');
  assert.equal(record.phone, lead.contact);
});

test('YDB store creates both TTL tables once and upserts both records', async () => {
  const createdTables = [];
  const existingTables = new Set();
  const queries = [];
  const session = {
    describeTable: async (tableName) => {
      if (existingTables.has(tableName)) return { tableName };
      const error = new Error(`Path ${tableName} was not found`);
      error.code = 400140;
      throw error;
    },
    createTable: async (tableName, description) => {
      existingTables.add(tableName);
      createdTables.push({ tableName, description });
    },
    prepareQuery: async (query) => query,
    executeQuery: async (query, params) => { queries.push({ query, params }); },
  };
  class Driver {
    constructor(options) { assert.equal(options.endpoint, env.ENDPOINT); assert.equal(options.database, env.DATABASE); this.tableClient = { withSessionRetry: async (callback) => callback(session) }; }
    async ready() { return true; }
  }
  const typed = (type) => (value) => ({ type, value });
  class Column { constructor(name, type) { this.name = name; this.type = type; } }
  class TableDescription {
    constructor() { this.columns = []; this.primaryKey = []; }
    withColumn(column) { this.columns.push(column); return this; }
    withPrimaryKey(column) { this.primaryKey.push(column); return this; }
    withTtl(columnName, expireAfterSeconds) { this.ttlSettings = { dateTypeColumn: { columnName, expireAfterSeconds } }; return this; }
  }
  class TokenAuthService { constructor(token) { assert.equal(token, context.token.access_token); } async getAuthMetadata() { return 'token-metadata'; } }
  const sdk = {
    Column,
    Driver,
    StatusCode: { SCHEME_ERROR: 400070, ALREADY_EXISTS: 400130, NOT_FOUND: 400140 },
    TableDescription,
    TokenAuthService,
    TypedValues: { utf8: typed('utf8'), timestamp: typed('timestamp') },
    Types: { UTF8: { typeId: 'UTF8' }, TIMESTAMP: { typeId: 'TIMESTAMP' } },
  };
  const store = createYdbStore({ env, sdk });
  await store.save(lead, '2026-09-11T12:00:00.000Z', context.token.access_token);
  await store.save(lead, '2026-09-11T12:00:01.000Z', context.token.access_token);
  assert.equal(createdTables.length, 2);
  assert.equal(createdTables[0].tableName, LEADS_TABLE);
  assert.equal(createdTables[1].tableName, CONSENT_TABLE);
  assert.deepEqual(createdTables[0].description.columns.map(({ name }) => name), LEADS_COLUMNS.map(([name]) => name));
  assert.deepEqual(createdTables[1].description.columns.map(({ name }) => name), CONSENT_COLUMNS.map(([name]) => name));
  assert.deepEqual(createdTables[0].description.primaryKey, ['submission_id']);
  assert.deepEqual(createdTables[0].description.ttlSettings, { dateTypeColumn: { columnName: 'expires_at', expireAfterSeconds: 0 } });
  assert.equal(queries.length, 2);
  assert.equal(queries[0].query, UPSERT_LEAD);
  assert.equal(queries[0].params.$phone.value, lead.contact);
  assert.equal(queries[0].params.$lead_expires_at.value.toISOString(), '2027-09-11T12:00:00.000Z');
  assert.equal(queries[0].params.$consent_expires_at.value.toISOString(), '2029-09-11T12:00:00.000Z');
});

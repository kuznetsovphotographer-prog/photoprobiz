const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, scryptSync } = require('node:crypto');
const { createHandler, publicLead } = require('./index.js');
const { CONSENT_COLUMNS, CONSENT_TABLE, DELETE_LEADS, LEADS_COLUMNS, LEADS_TABLE, LEAD_META_COLUMNS, LEAD_META_TABLE, UPSERT_LEAD, UPSERT_MANUAL_LEAD, createYdbStore, ensureColumns, storageRecord } = require('./storage.js');

const env = {
  ENDPOINT: 'grpcs://example.test:2135', DATABASE: '/test/database',
  TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: 'test-chat', RELAY_TOKEN: 'relay-test-token',
};
const lead = {
  name: 'Тест', contact: '+79990000000', contactMethod: 'phone', consent: true, source: 'modal', phoneCountry: 'RU',
  consentAcceptedAt: '2026-09-11T10:00:00.000Z', consentVersion: '2026-09-11',
  submissionId: '019a1234-5678-7000-8000-123456789abc', formId: 'modal-general',
  deviceType: 'computer', osFamily: 'windows',
};
const event = (payload = lead) => ({ httpMethod: 'POST', headers: { Origin: 'https://photoprobiz.ru', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const success = async () => ({ ok: true, json: async () => ({ ok: true }) });
const saved = () => ({ databaseConfigured: () => true, save: async () => {} });
const handler = (options = {}) => createHandler({ env, leadStore: saved(), ...options });
const context = { token: { access_token: 'test-function-iam-token' } };

test('consent rollout preserves the accepted document version and rejects unknown versions before storage', async () => {
  const recordedVersions = [];
  const handle = handler({
    fetchImpl: success,
    leadStore: { databaseConfigured: () => true, save: async (value) => recordedVersions.push(value.consentVersion) },
  });
  for (const consentVersion of ['2026-09-11', '2026-09-12', '2026-09-12-2', '2026-09-12-3']) {
    const result = await handle(event({ ...lead, consentVersion }), context);
    assert.equal(result.statusCode, 200);
  }
  const rejected = await handle(event({ ...lead, consentVersion: 'unknown-version' }), context);
  assert.equal(rejected.statusCode, 400);
  assert.deepEqual(recordedVersions, ['2026-09-11', '2026-09-12', '2026-09-12-2', '2026-09-12-3']);
});

test('the current consent version requires supported coarse device information while old pages remain compatible', async () => {
  const stored = [];
  const handle = handler({ fetchImpl: success, leadStore: { databaseConfigured: () => true, save: async (value) => stored.push(value) } });
  const current = { ...lead, consentVersion: '2026-09-12-3' };
  assert.equal((await handle(event(current), context)).statusCode, 200);
  const { deviceType: _deviceType, osFamily: _osFamily, ...withoutProfile } = current;
  assert.equal((await handle(event(withoutProfile), context)).statusCode, 400);
  assert.equal((await handle(event({ ...current, deviceType: 'watch' }), context)).statusCode, 400);
  assert.equal((await handle(event({ ...current, osFamily: 'windows-11' }), context)).statusCode, 400);
  assert.equal((await handle(event({ ...withoutProfile, consentVersion: '2026-09-12' }), context)).statusCode, 200);
  assert.equal(stored[0].deviceType, 'computer');
  assert.equal(stored[0].osFamily, 'windows');
  assert.equal(stored[1].deviceType, 'unknown');
  assert.equal(stored[1].osFamily, 'unknown');
});

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
  assert.equal(body.crmDatabasesConfigured, 1);
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
  const noteUpdates = [];
  const manualLeads = [];
  const leadStore = {
    databaseConfigured: () => true,
    list: async (_token, options) => {
      assert.equal(options.limit, 50);
      assert.equal(options.siteHost, 'photoprobiz.ru');
      return { rows: [row], hasMore: false };
    },
    get: async (id) => id === lead.submissionId ? row : null,
    sites: async () => ['photoprobiz.ru'],
    saveManual: async (manual) => manualLeads.push(manual),
    updateMeta: async (id, notes, manualSource, revenueRub) => { noteUpdates.push({ id, notes, manualSource, revenueRub }); return true; },
    updateStatus: async (id, status) => statusUpdates.push({ id, status }),
  };
  const instance = createHandler({ env: adminEnv, leadStore });
  const page = await instance({ httpMethod: 'GET', queryStringParameters: { admin: '1' }, headers: {} }, context);
  assert.equal(page.statusCode, 200);
  assert.match(page.headers['Content-Type'], /text\/html/);
  assert.ok(page.body.includes('Александр · CRM'));
  assert.ok(page.body.includes('Добавить клиента'));
  assert.ok(page.body.includes('Моя заметка'));
  assert.ok(page.body.includes('Стоимость моей работы'));
  assert.ok(page.body.includes('<svg viewBox="0 0 24 24"'));
  assert.ok(page.body.includes('class="add-icon"'));
  assert.ok(page.body.includes('id="selection-marquee"'));
  assert.ok(page.body.includes('function marqueeMove'));
  assert.ok(page.body.includes('list.onpointerdown'));
  assert.ok(page.body.includes('Удалить заявку'));
  assert.ok(page.body.includes('Выбрать все'));
  assert.ok(page.body.includes('https://max.ru/'));
  assert.ok(page.body.includes('Фильтр по месяцу'));
  assert.ok(page.body.includes('@media(max-width:1024px)'));
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
    httpMethod: 'GET', queryStringParameters: { admin_api: 'leads', limit: '50', site: 'photoprobiz.ru' }, headers: { 'X-Admin-Session': session },
  }, context);
  assert.equal(listed.statusCode, 200);
  const listedBody = JSON.parse(listed.body);
  assert.equal(listedBody.leads[0].name, lead.name);
  assert.equal(listedBody.leads[0].phone, lead.contact);
  assert.equal(listedBody.leads[0].serverReceivedAt, '2026-09-11T12:00:00.000Z');
  assert.equal(listedBody.leads[0].deviceType, 'unknown');
  assert.equal(listedBody.leads[0].osFamily, 'unknown');
  assert.equal(typeof listedBody.session, 'string');
  assert.notEqual(listedBody.session, session);

  const sites = await instance({
    httpMethod: 'GET', queryStringParameters: { admin_api: 'sites' }, headers: { 'X-Admin-Session': session },
  }, context);
  assert.equal(sites.statusCode, 200);
  assert.deepEqual(JSON.parse(sites.body).sites, [
    { host: 'manual.crm', label: 'Внесены вручную' },
    { host: 'photoprobiz.ru', label: 'Деловой фотограф' },
  ]);

  const updated = await instance({
    httpMethod: 'POST', queryStringParameters: { admin_api: 'status' },
    headers: { 'X-Admin-Session': session, Origin: 'https://functions.yandexcloud.net' },
    body: JSON.stringify({ submissionId: lead.submissionId, status: 'contacted' }),
  }, context);
  assert.equal(updated.statusCode, 200);
  assert.deepEqual(statusUpdates, [{ id: lead.submissionId, status: 'contacted' }]);

  const notes = await instance({
    httpMethod: 'POST', queryStringParameters: { admin_api: 'notes' },
    headers: { 'X-Admin-Session': session, Origin: 'https://functions.yandexcloud.net' },
    body: JSON.stringify({ submissionId: lead.submissionId, notes: 'Позвонить в пятницу', manualSource: '', revenueRub: 35000 }),
  }, context);
  assert.equal(notes.statusCode, 200);
  assert.deepEqual(noteUpdates, [{ id: lead.submissionId, notes: 'Позвонить в пятницу', manualSource: '', revenueRub: 35000 }]);

  const invalidRevenue = await instance({
    httpMethod: 'POST', queryStringParameters: { admin_api: 'notes' },
    headers: { 'X-Admin-Session': session, Origin: 'https://functions.yandexcloud.net' },
    body: JSON.stringify({ submissionId: lead.submissionId, notes: '', manualSource: '', revenueRub: -1 }),
  }, context);
  assert.equal(invalidRevenue.statusCode, 400);
});

test('CRM public model exposes only supported coarse device values', () => {
  assert.equal(publicLead({ device_type: 'tablet', os_family: 'ipados' }).deviceType, 'tablet');
  assert.equal(publicLead({ device_type: 'tablet', os_family: 'ipados' }).osFamily, 'ipados');
  assert.equal(publicLead({ device_type: 'watch', os_family: 'windows-11' }).deviceType, 'unknown');
  assert.equal(publicLead({ device_type: 'watch', os_family: 'windows-11' }).osFamily, 'unknown');
  assert.equal(publicLead({ revenue_rub: 42000 }).revenueRub, 42000);
  assert.equal(publicLead({ revenue_rub: -1 }).revenueRub, 0);
});

test('signed admin delete API enforces origin, auth, unique valid IDs and limit', async () => {
  const adminEnv = {
    ...env,
    ADMIN_BASE_URL: 'https://functions.yandexcloud.net/test-function-id',
    ADMIN_PASSWORD_SCRYPT: passwordHash('delete-password'),
    ADMIN_SESSION_SECRET: 'delete-test-admin-session-secret-at-least-32-characters',
  };
  const deletedBatches = [];
  const instance = createHandler({ env: adminEnv, leadStore: {
    databaseConfigured: () => true,
    deleteMany: async (ids) => { deletedBatches.push(ids); return { deletedIds: ids, failedIds: [] }; },
  } });
  const login = await instance({
    httpMethod: 'POST', queryStringParameters: { admin_api: 'login' },
    headers: { Origin: 'https://functions.yandexcloud.net' }, body: JSON.stringify({ password: 'delete-password' }),
  }, context);
  const session = JSON.parse(login.body).session;
  const base = { httpMethod: 'POST', queryStringParameters: { admin_api: 'delete' }, body: '' };
  const deniedOrigin = await instance({ ...base, headers: { Origin: 'https://example.org', 'X-Admin-Session': session }, body: JSON.stringify({ submissionIds: [lead.submissionId] }) }, context);
  assert.equal(deniedOrigin.statusCode, 403);
  const deniedAuth = await instance({ ...base, headers: { Origin: 'https://functions.yandexcloud.net' }, body: JSON.stringify({ submissionIds: [lead.submissionId] }) }, context);
  assert.equal(deniedAuth.statusCode, 401);
  for (const submissionIds of [[], ['bad'], [lead.submissionId, lead.submissionId], Array.from({ length: 51 }, (_, index) => `valid-id-123456-${index}`)]) {
    const response = await instance({ ...base, headers: { Origin: 'https://functions.yandexcloud.net', 'X-Admin-Session': session }, body: JSON.stringify({ submissionIds }) }, context);
    assert.equal(response.statusCode, 400);
  }
  const success = await instance({ ...base, headers: { Origin: 'https://functions.yandexcloud.net', 'X-Admin-Session': session }, body: JSON.stringify({ submissionIds: [lead.submissionId] }) }, context);
  assert.equal(success.statusCode, 200);
  assert.deepEqual(JSON.parse(success.body).deletedIds, [lead.submissionId]);
  assert.deepEqual(deletedBatches, [[lead.submissionId]]);
});

test('admin delete API reports partial failures and rejects database collisions', async () => {
  const adminEnv = {
    ...env,
    ADMIN_BASE_URL: 'https://functions.yandexcloud.net/test-function-id',
    ADMIN_PASSWORD_SCRYPT: passwordHash('delete-password'),
    ADMIN_SESSION_SECRET: 'delete-test-admin-session-secret-at-least-32-characters',
  };
  async function signed(store) {
    const instance = createHandler({ env: adminEnv, leadStore: store });
    const login = await instance({ httpMethod: 'POST', queryStringParameters: { admin_api: 'login' }, headers: { Origin: 'https://functions.yandexcloud.net' }, body: JSON.stringify({ password: 'delete-password' }) }, context);
    return { instance, session: JSON.parse(login.body).session };
  }
  const partial = await signed({ databaseConfigured: () => true, deleteMany: async (ids) => ({ deletedIds: [ids[0]], failedIds: [ids[1]] }) });
  const partialResponse = await partial.instance({ httpMethod: 'POST', queryStringParameters: { admin_api: 'delete' }, headers: { Origin: 'https://functions.yandexcloud.net', 'X-Admin-Session': partial.session }, body: JSON.stringify({ submissionIds: [lead.submissionId, 'another-valid-id-1234'] }) }, context);
  assert.equal(partialResponse.statusCode, 207);
  assert.deepEqual(JSON.parse(partialResponse.body).failedIds, ['another-valid-id-1234']);
  const collisionError = Object.assign(new Error('collision'), { code: 'AMBIGUOUS_LEAD_ID' });
  const collision = await signed({ databaseConfigured: () => true, deleteMany: async () => { throw collisionError; } });
  const collisionResponse = await collision.instance({ httpMethod: 'POST', queryStringParameters: { admin_api: 'delete' }, headers: { Origin: 'https://functions.yandexcloud.net', 'X-Admin-Session': collision.session }, body: JSON.stringify({ submissionIds: [lead.submissionId] }) }, context);
  assert.equal(collisionResponse.statusCode, 409);
});

test('admin periods API groups stored timestamps by Moscow calendar month', async () => {
  const adminEnv = {
    ...env,
    ADMIN_BASE_URL: 'https://functions.yandexcloud.net/test-function-id',
    ADMIN_PASSWORD_SCRYPT: passwordHash('period-password'),
    ADMIN_SESSION_SECRET: 'period-test-admin-session-secret-at-least-32-characters',
  };
  const instance = createHandler({ env: adminEnv, leadStore: {
    databaseConfigured: () => true,
    periods: async (_token, options) => {
      assert.equal(options.siteHost, 'photoprobiz.ru');
      return [new Date('2026-08-31T21:30:00Z'), new Date('2026-09-30T20:59:00Z'), new Date('2026-09-30T21:00:00Z')];
    },
  } });
  const login = await instance({ httpMethod: 'POST', queryStringParameters: { admin_api: 'login' }, headers: { Origin: 'https://functions.yandexcloud.net' }, body: JSON.stringify({ password: 'period-password' }) }, context);
  const session = JSON.parse(login.body).session;
  const response = await instance({ httpMethod: 'GET', queryStringParameters: { admin_api: 'periods', site: 'photoprobiz.ru' }, headers: { 'X-Admin-Session': session } }, context);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body).periods, ['2026-10', '2026-09']);
});

test('a configured second site is identified by origin and stored under its own host', async () => {
  const secondEnv = {
    ...env,
    DELIVERY_MODE: 'cloudflare-relay',
    CRM_SITES_JSON: JSON.stringify([{
      siteHost: 'example-photo.ru', label: 'Свадебный сайт', origins: ['https://example-photo.ru'],
      consentVersions: ['2026-09-11'], formIds: ['contact-form'], packages: [],
    }]),
  };
  let storedHost = '';
  const instance = createHandler({ env: secondEnv, leadStore: {
    databaseConfigured: () => true,
    save: async (_lead, _time, _token, siteHost) => { storedHost = siteHost; },
  }, fetchImpl: async (_url, options) => {
    assert.equal(JSON.parse(options.body).site, 'example-photo.ru');
    return success();
  } });
  const result = await instance({
    ...event({ ...lead, formId: 'contact-form', packageName: undefined }),
    headers: { Origin: 'https://example-photo.ru', 'Content-Type': 'application/json' },
  }, context);
  assert.equal(result.statusCode, 200);
  assert.equal(storedHost, 'example-photo.ru');
});

test('signed admin API creates manual contacts without a consent event', async () => {
  const adminEnv = {
    ...env,
    ADMIN_BASE_URL: 'https://functions.yandexcloud.net/test-function-id',
    ADMIN_PASSWORD_SCRYPT: passwordHash('crm-password'),
    ADMIN_SESSION_SECRET: 'another-test-admin-session-secret-at-least-32-characters',
  };
  let savedManual;
  const leadStore = {
    databaseConfigured: () => true,
    saveManual: async (value) => { savedManual = value; },
    get: async (id) => ({
      submission_id: id, server_received_at: new Date('2026-09-11T12:00:00.000Z'),
      consent_accepted_at: new Date('2026-09-11T12:00:00.000Z'), consent_version: '',
      form_id: 'crm-manual', source: 'manual', site_host: 'manual.crm', name: savedManual.name,
      phone: savedManual.contact, contact_method: savedManual.contactMethod, package_name: '', phone_country: '',
      status: 'new', expires_at: new Date('2027-09-11T12:00:00.000Z'), notes: savedManual.notes,
      manual_source: savedManual.manualSource,
    }),
  };
  const instance = createHandler({ env: adminEnv, leadStore });
  const login = await instance({
    httpMethod: 'POST', queryStringParameters: { admin_api: 'login' },
    headers: { Origin: 'https://functions.yandexcloud.net' }, body: JSON.stringify({ password: 'crm-password' }),
  }, context);
  const session = JSON.parse(login.body).session;
  const created = await instance({
    httpMethod: 'POST', queryStringParameters: { admin_api: 'manual' },
    headers: { Origin: 'https://functions.yandexcloud.net', 'X-Admin-Session': session },
    body: JSON.stringify({ name: 'Мария', phone: '+79991112233', contactMethod: 'telegram', manualSource: 'Рекомендация', notes: 'Нужна съёмка команды' }),
  }, context);
  assert.equal(created.statusCode, 201);
  assert.match(savedManual.submissionId, /^[a-f0-9-]{36}$/);
  assert.equal(savedManual.manualSource, 'Рекомендация');
  const createdLead = JSON.parse(created.body).lead;
  assert.equal(createdLead.siteHost, 'manual.crm');
  assert.equal(createdLead.notes, 'Нужна съёмка команды');
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
  assert.equal(record.deviceType, 'computer');
  assert.equal(record.osFamily, 'windows');
});

test('existing YDB lead tables receive nullable device columns without rebuilding stored data', async () => {
  const altered = [];
  class Column { constructor(name, type) { this.name = name; this.type = type; } }
  class AlterTableDescription {
    constructor() { this.columns = []; }
    withAddColumn(column) { this.columns.push(column); return this; }
  }
  const sdk = {
    AlterTableDescription,
    Column,
    Types: { UTF8: { typeId: 'UTF8' }, optional: (type) => ({ optional: true, type }) },
  };
  const session = { alterTable: async (tableName, description) => altered.push({ tableName, description }) };
  await ensureColumns(session, sdk, LEADS_TABLE, [['device_type', 'UTF8'], ['os_family', 'UTF8']], {
    columns: LEADS_COLUMNS.filter(([name]) => !['device_type', 'os_family'].includes(name)).map(([name]) => ({ name })),
  });
  assert.equal(altered.length, 1);
  assert.equal(altered[0].tableName, LEADS_TABLE);
  assert.deepEqual(altered[0].description.columns.map(({ name, type }) => ({ name, optional: type.optional })), [
    { name: 'device_type', optional: true }, { name: 'os_family', optional: true },
  ]);
});

test('existing CRM metadata tables receive a nullable revenue column without rebuilding stored notes', async () => {
  const altered = [];
  class Column { constructor(name, type) { this.name = name; this.type = type; } }
  class AlterTableDescription {
    constructor() { this.columns = []; }
    withAddColumn(column) { this.columns.push(column); return this; }
  }
  const sdk = {
    AlterTableDescription,
    Column,
    Types: { UINT64: { typeId: 'UINT64' }, optional: (type) => ({ optional: true, type }) },
  };
  const session = { alterTable: async (tableName, description) => altered.push({ tableName, description }) };
  await ensureColumns(session, sdk, LEAD_META_TABLE, [['revenue_rub', 'UINT64']], {
    columns: LEAD_META_COLUMNS.filter(([name]) => name !== 'revenue_rub').map(([name]) => ({ name })),
  });
  assert.equal(altered.length, 1);
  assert.equal(altered[0].tableName, LEAD_META_TABLE);
  assert.deepEqual(altered[0].description.columns.map(({ name, type }) => ({ name, optional: type.optional })), [
    { name: 'revenue_rub', optional: true },
  ]);
});

test('YDB store creates lead, consent and CRM metadata tables once and upserts both consent records', async () => {
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
    TypedValues: { utf8: typed('utf8'), uint64: typed('uint64'), timestamp: typed('timestamp'), list: (type, value) => ({ type: 'list', itemType: type, value }) },
    Types: { UTF8: { typeId: 'UTF8' }, UINT64: { typeId: 'UINT64' }, TIMESTAMP: { typeId: 'TIMESTAMP' } },
  };
  const store = createYdbStore({ env, sdk });
  await store.save(lead, '2026-09-11T12:00:00.000Z', context.token.access_token);
  await store.save(lead, '2026-09-11T12:00:01.000Z', context.token.access_token);
  assert.equal(createdTables.length, 3);
  assert.equal(createdTables[0].tableName, LEADS_TABLE);
  assert.equal(createdTables[1].tableName, CONSENT_TABLE);
  assert.equal(createdTables[2].tableName, LEAD_META_TABLE);
  assert.deepEqual(createdTables[0].description.columns.map(({ name }) => name), LEADS_COLUMNS.map(([name]) => name));
  assert.deepEqual(createdTables[1].description.columns.map(({ name }) => name), CONSENT_COLUMNS.map(([name]) => name));
  assert.deepEqual(createdTables[2].description.columns.map(({ name }) => name), LEAD_META_COLUMNS.map(([name]) => name));
  assert.deepEqual(createdTables[0].description.primaryKey, ['submission_id']);
  assert.deepEqual(createdTables[0].description.ttlSettings, { dateTypeColumn: { columnName: 'expires_at', expireAfterSeconds: 0 } });
  assert.equal(queries.length, 2);
  assert.equal(queries[0].query, UPSERT_LEAD);
  assert.equal(queries[0].params.$phone.value, lead.contact);
  assert.equal(queries[0].params.$device_type.value, 'computer');
  assert.equal(queries[0].params.$os_family.value, 'windows');
  assert.equal(queries[0].params.$lead_expires_at.value.toISOString(), '2027-09-11T12:00:00.000Z');
  assert.equal(queries[0].params.$consent_expires_at.value.toISOString(), '2029-09-11T12:00:00.000Z');

  await store.saveManual({ submissionId: 'manual-1234567890abcdef', name: 'Мария', contact: '+79991112233', contactMethod: 'phone', notes: 'Позвонить', manualSource: 'Рекомендация' }, '2026-09-11T13:00:00.000Z', context.token.access_token);
  assert.equal(queries.length, 3);
  assert.equal(queries[2].query, UPSERT_MANUAL_LEAD);
  assert.equal(queries[2].params.$site_host.value, 'manual.crm');
  assert.equal(queries[2].params.$notes.value, 'Позвонить');
  assert.equal(queries[2].params.$revenue_rub.value, 0);

  await store.deleteMany([lead.submissionId], context.token.access_token);
  assert.equal(queries[3].query, DELETE_LEADS);
  assert.deepEqual(queries[3].params.$submission_ids.value, [lead.submissionId]);
  assert.match(queries[3].query, /DELETE FROM lead_meta/);
  assert.match(queries[3].query, /DELETE FROM consent_events/);
  assert.match(queries[3].query, /DELETE FROM leads/);
});

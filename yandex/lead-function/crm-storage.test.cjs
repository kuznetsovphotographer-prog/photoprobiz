const { test } = require('node:test');
const assert = require('node:assert/strict');
const { INTERIORS_DELETE_LEADS, INTERIORS_SELECT, createCrmStore, estimateLabel } = require('./crm-storage.js');

const row = (id, site, time) => ({ submission_id: id, site_host: site, server_received_at: new Date(time) });
function fixture({ collision = false } = {}) {
  const calls = [];
  const primaryRows = [row('business-1', 'photoprobiz.ru', '2026-09-11T10:00:00Z')];
  const interiorRows = [row(collision ? 'business-1' : 'interior-1', 'prointeriors.ru', '2026-09-11T11:00:00Z')];
  const primaryStore = {
    databaseConfigured: () => true, sites: async () => ['photoprobiz.ru'],
    list: async (_token, options) => ({ rows: options.siteHost === 'prointeriors.ru' ? [] : primaryRows, hasMore: false }),
    get: async (id) => primaryRows.find(value => value.submission_id === id) || null,
    save: async (...args) => calls.push(['primary-save', ...args]),
    saveManual: async (...args) => calls.push(['primary-manual', ...args]),
    updateStatus: async (...args) => calls.push(['primary-status', ...args]),
    updateMeta: async (...args) => { calls.push(['primary-meta', ...args]); return true; },
    existingIds: async (ids) => ids.filter(id => primaryRows.some(value => value.submission_id === id)),
    deleteMany: async (...args) => calls.push(['primary-delete', ...args]),
    periods: async () => primaryRows.map(value => value.server_received_at),
  };
  const interiorsStore = {
    configured: () => true,
    list: async () => ({ rows: interiorRows, hasMore: false }),
    get: async (id) => interiorRows.find(value => value.submission_id === id) || null,
    updateStatus: async (...args) => calls.push(['interior-status', ...args]),
    updateMeta: async (...args) => { calls.push(['interior-meta', ...args]); return true; },
    existingIds: async (ids) => ids.filter(id => interiorRows.some(value => value.submission_id === id)),
    deleteMany: async (...args) => calls.push(['interior-delete', ...args]),
    periods: async () => interiorRows.map(value => value.server_received_at),
  };
  return { calls, store: createCrmStore({ primaryStore, interiorsStore }) };
}

test('CRM merges both databases newest-first and exposes a stable label', async () => {
  const { store } = fixture();
  assert.equal(store.databaseConfigured(), true);
  assert.equal(store.databaseCount(), 2);
  assert.deepEqual(store.siteLabels(), { 'prointeriors.ru': 'Интерьерная съёмка' });
  assert.deepEqual(await store.sites('token'), ['photoprobiz.ru', 'prointeriors.ru']);
  const result = await store.list('token', { limit: 50 });
  assert.deepEqual(result.rows.map(value => value.submission_id), ['interior-1', 'business-1']);
  assert.equal((await store.periods('token')).length, 2);
  assert.deepEqual(await store.periods('token', { siteHost: 'prointeriors.ru' }), [new Date('2026-09-11T11:00:00Z')]);
});

test('site filters and all writes stay in the database that owns the lead', async () => {
  const { calls, store } = fixture();
  assert.deepEqual((await store.list('token', { siteHost: 'prointeriors.ru' })).rows.map(value => value.submission_id), ['interior-1']);
  await store.updateStatus('interior-1', 'contacted', 'token');
  await store.updateMeta('interior-1', 'note', '', 'token');
  await store.updateStatus('business-1', 'closed', 'token');
  await store.save({ name: 'business' }, 'time', 'token', 'photoprobiz.ru');
  assert.deepEqual(calls.map(value => value[0]), ['interior-status', 'interior-meta', 'primary-status', 'primary-save']);
});

test('same UUID in two databases fails closed instead of updating the wrong client', async () => {
  const { calls, store } = fixture({ collision: true });
  await assert.rejects(() => store.updateStatus('business-1', 'closed', 'token'), { code: 'AMBIGUOUS_LEAD_ID' });
  assert.deepEqual(calls, []);
});

test('CRM deletes each lead from its owning database and treats absent IDs as complete', async () => {
  const { calls, store } = fixture();
  const result = await store.deleteMany(['business-1', 'missing-123456789', 'interior-1'], 'token');
  assert.deepEqual(result, {
    deletedIds: ['business-1', 'missing-123456789', 'interior-1'],
    failedIds: [],
  });
  assert.deepEqual(calls.filter(value => value[0].endsWith('-delete')), [
    ['primary-delete', ['business-1'], 'token'],
    ['interior-delete', ['interior-1'], 'token'],
  ]);
});

test('CRM rejects deletion when the same ID exists in both databases', async () => {
  const { calls, store } = fixture({ collision: true });
  await assert.rejects(() => store.deleteMany(['business-1'], 'token'), { code: 'AMBIGUOUS_LEAD_ID' });
  assert.deepEqual(calls, []);
});

test('CRM reports only the failed database group after a partial delete', async () => {
  const { store } = fixture();
  store.get = store.get.bind(store);
  const primaryStore = {
    databaseConfigured: () => true, sites: async () => [], list: async () => ({ rows: [], hasMore: false }),
    get: async () => null, save: async () => {}, saveManual: async () => {}, updateStatus: async () => {}, updateMeta: async () => true,
    existingIds: async (ids) => ids.filter(id => id === 'business-1'), deleteMany: async () => {},
  };
  const interiorsStore = {
    configured: () => true, list: async () => ({ rows: [], hasMore: false }), get: async () => null,
    updateStatus: async () => {}, updateMeta: async () => true,
    existingIds: async (ids) => ids.filter(id => id === 'interior-1'), deleteMany: async () => { throw new Error('write failed'); },
  };
  const partialStore = createCrmStore({ primaryStore, interiorsStore });
  assert.deepEqual(await partialStore.deleteMany(['business-1', 'interior-1'], 'token'), {
    deletedIds: ['business-1'], failedIds: ['interior-1'],
  });
});

test('interior estimate becomes readable CRM text without throwing on corrupt legacy data', () => {
  assert.equal(estimateLabel(JSON.stringify({ total: 25000, items: [
    { label: 'Номер', quantity: 2 }, { label: 'Общественная зона', quantity: 1 },
  ] })), '≈ 25 000 ₽ · Номер × 2 · Общественная зона');
  assert.equal(estimateLabel('{'), 'Предварительный расчёт');
});

test('interior adapter reads the two coarse device columns and no raw client fingerprint', () => {
  assert.match(INTERIORS_SELECT, /l\.device_type/);
  assert.match(INTERIORS_SELECT, /l\.os_family/);
  assert.doesNotMatch(INTERIORS_SELECT, /user_agent|ip_address|browser_version|device_model/i);
});

test('interior deletion removes all linked rows in one multi-statement query', () => {
  assert.match(INTERIORS_DELETE_LEADS, /DELETE FROM lead_meta/);
  assert.match(INTERIORS_DELETE_LEADS, /DELETE FROM consent_events/);
  assert.match(INTERIORS_DELETE_LEADS, /DELETE FROM leads/);
  assert.equal((INTERIORS_DELETE_LEADS.match(/DECLARE \$ids/g) || []).length, 1);
});

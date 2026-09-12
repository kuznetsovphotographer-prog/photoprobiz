const { test } = require('node:test');
const assert = require('node:assert/strict');
const { INTERIORS_SELECT, createCrmStore, estimateLabel } = require('./crm-storage.js');

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
  };
  const interiorsStore = {
    configured: () => true,
    list: async () => ({ rows: interiorRows, hasMore: false }),
    get: async (id) => interiorRows.find(value => value.submission_id === id) || null,
    updateStatus: async (...args) => calls.push(['interior-status', ...args]),
    updateMeta: async (...args) => { calls.push(['interior-meta', ...args]); return true; },
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

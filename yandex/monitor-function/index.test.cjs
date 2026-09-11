const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, moscowParts, nextState } = require('./index.js');

const env = {
  MAIN_SITE_URL: 'https://photoprobiz.ru/', YANDEX_HEALTH_URL: 'https://functions.yandexcloud.net/test',
  CLOUDFLARE_HEALTH_URL: 'https://api.photoprobiz.ru/health', RELAY_URL: 'https://api.photoprobiz.ru/monitor', RELAY_TOKEN: 'test-token',
};

function successFetch(url, options = {}) {
  if (options.method === 'POST') return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });
  if (url.includes('photoprobiz.ru') && !url.includes('/health')) return Promise.resolve({ ok: true, status: 200, text: async () => `<html>${'photoprobiz '.repeat(120)}</html>` });
  if (url.includes('functions.yandexcloud.net')) return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, databaseConfigured: true, adminConfigured: true }) });
  return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, telegramConfigured: true, relayConfigured: true }) });
}

function memoryStore(initial = {}) {
  const states = new Map(Object.entries(initial));
  const checks = [];
  return {
    checks, states,
    async getState(key) { return states.get(key) || null; },
    async recordCheck(result, next) {
      checks.push(result);
      states.set(result.target, {
        consecutive_failures: next.consecutiveFailures, incident_open: next.incidentOpen, alert_sent: next.alertSent,
        incident_started_at: next.incidentStartedAt, last_notified_at: next.lastNotifiedAt, last_daily_date: next.lastDailyDate,
      });
    },
    async updateNotification(key, value) {
      const current = states.get(key) || {};
      states.set(key, { ...current, alert_sent: value.alertSent, incident_open: value.incidentOpen,
        consecutive_failures: value.consecutiveFailures, last_notified_at: value.notifiedAt, last_daily_date: value.dailyDate });
    },
  };
}

test('Moscow daily window is calculated independently of runtime timezone', () => {
  assert.deepEqual(moscowParts('2026-09-12T07:00:00.000Z'), { date: '2026-09-12', hour: 10 });
});

test('incident opens only after three failures and stays pending until recovery notification', () => {
  const base = { consecutiveFailures: 0, incidentOpen: false, alertSent: false, incidentStartedAt: '1970-01-01T00:00:00.000Z', lastNotifiedAt: '1970-01-01T00:00:00.000Z', lastDailyDate: '' };
  const failed = { ok: false, checkedAt: '2026-09-12T01:00:00.000Z' };
  const one = nextState(base, failed); const two = nextState(one, failed); const three = nextState(two, failed);
  assert.equal(one.incidentOpen, false); assert.equal(two.incidentOpen, false); assert.equal(three.incidentOpen, true);
  assert.equal(nextState(three, { ok: true }).incidentOpen, true);
});

test('healthy hourly run stores all checks and sends daily heartbeat at 10 Moscow', async () => {
  const store = memoryStore();
  const notifications = [];
  const fetchImpl = async (url, options) => {
    if (options?.method === 'POST') { notifications.push(JSON.parse(options.body)); return { ok: true, status: 200, json: async () => ({ ok: true }) }; }
    return successFetch(url, options);
  };
  const handler = createHandler({ env, fetchImpl, monitorStore: store, now: () => new Date('2026-09-12T07:00:00.000Z') });
  const result = await handler({}, { token: { access_token: 'test' } });
  assert.equal(result.ok, true);
  assert.equal(store.checks.length, 4);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].kind, 'daily');
  assert.match(notifications[0].message, /Все системы работают/);
});

test('third failed run sends one alert and a later healthy run sends recovery', async () => {
  const old = '2026-09-12T01:00:00.000Z';
  const store = memoryStore({ site: { consecutive_failures: 2, incident_open: false, alert_sent: false, incident_started_at: old, last_notified_at: old, last_daily_date: '' } });
  const notifications = [];
  let siteFails = true;
  const fetchImpl = async (url, options) => {
    if (options?.method === 'POST') { notifications.push(JSON.parse(options.body)); return { ok: true, status: 200, json: async () => ({ ok: true }) }; }
    if (siteFails && url === env.MAIN_SITE_URL) return { ok: false, status: 503, text: async () => '' };
    return successFetch(url, options);
  };
  await createHandler({ env, fetchImpl, monitorStore: store, now: () => new Date('2026-09-12T03:00:00.000Z') })({}, { token: { access_token: 'test' } });
  assert.equal(notifications[0].kind, 'alert');
  siteFails = false;
  await createHandler({ env, fetchImpl, monitorStore: store, now: () => new Date('2026-09-12T04:00:00.000Z') })({}, { token: { access_token: 'test' } });
  assert.equal(notifications[1].kind, 'recovery');
});

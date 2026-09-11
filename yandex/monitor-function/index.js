'use strict';

const { createMonitorStore } = require('./storage.js');

const THREE_FAILURES = 3;
const EPOCH = '1970-01-01T00:00:00.000Z';

function cleanError(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').replace(/https?:\/\/[^\s]+/g, '[адрес]').slice(0, 300);
}

function targets(env) {
  return [
    { key: 'site', label: 'Основной сайт', url: env.MAIN_SITE_URL, kind: 'html' },
    { key: 'yandex', label: 'Приём заявок и YDB', url: env.YANDEX_HEALTH_URL, kind: 'yandex' },
    { key: 'cloudflare', label: 'Telegram-посредник', url: env.CLOUDFLARE_HEALTH_URL, kind: 'cloudflare' },
  ].filter((target) => Boolean(target.url));
}

async function checkTarget(target, fetchImpl, timeoutMs, checkedAt) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let statusCode = 0;
  try {
    const response = await fetchImpl(target.url, {
      method: 'GET', headers: { Accept: target.kind === 'html' ? 'text/html' : 'application/json' },
      redirect: 'follow', cache: 'no-store', signal: controller.signal,
    });
    statusCode = response.status;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (target.kind === 'html') {
      const body = await response.text();
      if (body.length < 1000 || !/<html/i.test(body) || !/photoprobiz/i.test(body)) throw new Error('Контрольный текст сайта не найден');
    } else {
      const body = await response.json();
      if (body?.ok !== true) throw new Error('Проверка состояния вернула ошибку');
      if (target.kind === 'yandex' && (body.databaseConfigured !== true || body.adminConfigured !== true)) throw new Error('YDB или кабинет не настроен');
      if (target.kind === 'cloudflare' && (body.telegramConfigured !== true || body.relayConfigured !== true)) throw new Error('Telegram или relay не настроен');
    }
    return { target: target.key, label: target.label, url: target.url, checkedAt, ok: true, statusCode, durationMs: Date.now() - started, error: '' };
  } catch (error) {
    return {
      target: target.key, label: target.label, url: target.url, checkedAt, ok: false, statusCode,
      durationMs: Date.now() - started,
      error: controller.signal.aborted ? `Тайм-аут ${Math.round(timeoutMs / 1000)} секунд` : cleanError(error?.message || error),
    };
  } finally { clearTimeout(timer); }
}

function normalizeState(row) {
  return {
    consecutiveFailures: Number(row?.consecutive_failures || 0), incidentOpen: Boolean(row?.incident_open),
    alertSent: Boolean(row?.alert_sent), incidentStartedAt: row?.incident_started_at ? new Date(row.incident_started_at).toISOString() : EPOCH,
    lastNotifiedAt: row?.last_notified_at ? new Date(row.last_notified_at).toISOString() : EPOCH,
    lastDailyDate: String(row?.last_daily_date || ''),
  };
}

function nextState(previous, result) {
  if (result.ok) return previous.incidentOpen ? {
    consecutiveFailures: 0, incidentOpen: true, alertSent: previous.alertSent,
    incidentStartedAt: previous.incidentStartedAt, lastNotifiedAt: previous.lastNotifiedAt, lastDailyDate: previous.lastDailyDate,
  } : {
    consecutiveFailures: 0, incidentOpen: false, alertSent: false,
    incidentStartedAt: EPOCH, lastNotifiedAt: previous.lastNotifiedAt, lastDailyDate: previous.lastDailyDate,
  };
  const failures = previous.consecutiveFailures + 1;
  return {
    consecutiveFailures: failures, incidentOpen: failures >= THREE_FAILURES,
    alertSent: previous.alertSent,
    incidentStartedAt: previous.consecutiveFailures > 0 ? previous.incidentStartedAt : result.checkedAt,
    lastNotifiedAt: previous.lastNotifiedAt, lastDailyDate: previous.lastDailyDate,
  };
}

function moscowParts(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const pick = (type) => parts.find((part) => part.type === type)?.value || '';
  return { date: `${pick('year')}-${pick('month')}-${pick('day')}`, hour: Number(pick('hour')) };
}

function moscowDateTime(value) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function alertMessage(result, failures) {
  return ['🔴 Сбой photoprobiz.ru', '', `Компонент: ${result.label}`, `Время: ${moscowDateTime(result.checkedAt)}`,
    `Ошибка: ${result.error || `HTTP ${result.statusCode || 0}`}`, `Код ответа: ${result.statusCode || 'нет'}`,
    `Время ответа: ${result.durationMs} мс`, `Неудачных проверок подряд: ${failures}`].join('\n');
}

function recoveryMessage(result, startedAt) {
  const downtime = Math.max(1, Math.round((Date.parse(result.checkedAt) - Date.parse(startedAt)) / 60000));
  return ['🟢 photoprobiz.ru снова работает', '', `Компонент: ${result.label}`,
    `Восстановлен: ${moscowDateTime(result.checkedAt)}`, `Примерный простой: ${downtime} мин`,
    `Код ответа: ${result.statusCode}`, `Время ответа: ${result.durationMs} мс`].join('\n');
}

function dailyMessage(results, checkedAt) {
  return ['🟢 Все системы работают', '', `Сайт photoprobiz.ru`, `Проверено: ${moscowDateTime(checkedAt)}`, '',
    ...results.map((result) => `${result.label}: ${result.statusCode} · ${result.durationMs} мс`)].join('\n');
}

async function deliver(env, fetchImpl, kind, message, timeoutMs) {
  if (!env.RELAY_TOKEN?.trim() || !env.RELAY_URL?.trim()) throw new Error('Monitor relay is not configured.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(env.RELAY_URL.trim(), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://photoprobiz.ru', 'X-Relay-Token': env.RELAY_TOKEN.trim() },
      body: JSON.stringify({ event: 'site_monitor', site: 'photoprobiz.ru', kind, message }), signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok !== true) throw new Error(`Relay HTTP ${response.status}`);
  } finally { clearTimeout(timer); }
}

function createHandler({ env = process.env, fetchImpl = globalThis.fetch, monitorStore, timeoutMs = 10000, now = () => new Date() } = {}) {
  const store = monitorStore || createMonitorStore({ env });
  return async function handler(event, context = {}) {
    const checkedAt = now().toISOString();
    const configuredTargets = targets(env);
    if (configuredTargets.length !== 3) throw new Error('All three monitor targets must be configured.');
    const results = [];
    const pendingNotifications = [];

    for (const target of configuredTargets) {
      const previous = normalizeState(await store.getState(target.key, context?.token?.access_token));
      const result = await checkTarget(target, fetchImpl, timeoutMs, checkedAt);
      const next = nextState(previous, result);
      await store.recordCheck(result, next, context?.token?.access_token);
      results.push(result);
      if (!result.ok && next.incidentOpen && !previous.alertSent) {
        pendingNotifications.push({ kind: 'alert', target: target.key, result, next, message: alertMessage(result, next.consecutiveFailures) });
      } else if (result.ok && previous.incidentOpen) {
        pendingNotifications.push({ kind: 'recovery', target: target.key, result, next, message: recoveryMessage(result, previous.incidentStartedAt) });
      }
    }

    for (const notification of pendingNotifications) {
      await deliver(env, fetchImpl, notification.kind, notification.message, timeoutMs);
      await store.updateNotification(notification.target, {
        alertSent: notification.kind === 'alert', notifiedAt: checkedAt,
        incidentOpen: notification.kind === 'alert',
        consecutiveFailures: notification.kind === 'alert' ? notification.next.consecutiveFailures : 0,
        dailyDate: notification.next.lastDailyDate,
      }, context?.token?.access_token);
    }

    const time = moscowParts(checkedAt);
    const dailyState = normalizeState(await store.getState('__daily__', context?.token?.access_token));
    if (time.hour === 10 && dailyState.lastDailyDate !== time.date && results.every((result) => result.ok)) {
      await deliver(env, fetchImpl, 'daily', dailyMessage(results, checkedAt), timeoutMs);
      const dailyResult = { target: '__daily__', label: 'Ежедневный отчёт', url: 'internal://daily', checkedAt, ok: true, statusCode: 200, durationMs: 0, error: '' };
      const dailyNext = { ...nextState(dailyState, dailyResult), lastDailyDate: time.date, lastNotifiedAt: checkedAt };
      await store.recordCheck(dailyResult, dailyNext, context?.token?.access_token);
      await store.updateNotification('__daily__', { alertSent: false, notifiedAt: checkedAt, dailyDate: time.date, incidentOpen: false, consecutiveFailures: 0 }, context?.token?.access_token);
    }

    return { ok: results.every((result) => result.ok), checkedAt, results: results.map(({ url, ...result }) => result) };
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.checkTarget = checkTarget;
exports.moscowParts = moscowParts;
exports.nextState = nextState;

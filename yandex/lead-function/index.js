'use strict';

const { createYdbStore } = require('./storage.js');

const allowedOrigins = new Set([
  'https://photoprobiz.ru', 'https://www.photoprobiz.ru',
  'https://kuznetsovphotographer-prog.github.io',
  'http://127.0.0.1:4173', 'http://127.0.0.1:5173',
  'http://localhost:4173', 'http://localhost:5173',
]);
const methods = { phone: 'Телефон', telegram: 'Telegram', whatsapp: 'WhatsApp', max_messenger: 'Max' };
const sources = { modal: 'Всплывающая форма', inline: 'Форма на странице' };
const packages = new Set(['Минимальный', 'Базовый', 'Полный']);
const formIds = new Set(['homepage-inline', 'modal-general', 'modal-package-minimal', 'modal-package-base', 'modal-package-full']);
const CONSENT_VERSION = '2026-09-11';
const MAX_BODY_BYTES = 8192;

function parseLead(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const contact = typeof value.contact === 'string' ? value.contact.trim() : '';
  if (!name || name.length > 100 || !/[\p{L}]/u.test(name) || /[\d<>\r\n]/u.test(name)) return null;
  if (!/^\+\d{10,15}$/.test(contact) || value.consent !== true) return null;
  if (!Object.hasOwn(methods, value.contactMethod) || !Object.hasOwn(sources, value.source)) return null;
  if (value.packageName !== undefined && !packages.has(value.packageName)) return null;
  if (value.phoneCountry !== undefined && (typeof value.phoneCountry !== 'string' || !/^[A-Za-z]{2}$/.test(value.phoneCountry))) return null;
  if (value.consentVersion !== CONSENT_VERSION || !formIds.has(value.formId)) return null;
  if (typeof value.submissionId !== 'string' || !/^[A-Za-z0-9-]{16,80}$/.test(value.submissionId)) return null;
  if (typeof value.consentAcceptedAt !== 'string' || !Number.isFinite(Date.parse(value.consentAcceptedAt))) return null;
  return {
    name, contact, contactMethod: value.contactMethod, source: value.source,
    packageName: value.packageName, phoneCountry: value.phoneCountry,
    consentVersion: value.consentVersion, consentAcceptedAt: value.consentAcceptedAt,
    submissionId: value.submissionId, formId: value.formId,
  };
}

function notificationMessage(lead, serverReceivedAt) {
  return [
    'Новая заявка с сайта photoprobiz', '',
    `ID заявки: ${lead.submissionId}`,
    `Получено сервером: ${new Date(serverReceivedAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`,
    'Имя и телефон сохранены в YDB.',
  ].join('\n');
}

function safeYdbDiagnostic(error) {
  const clean = (value, max = 500) => String(value || '')
    .replace(/\+\d{10,15}/g, '[phone-redacted]')
    .replace(/[A-Za-z0-9_-]{35,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, '[token-redacted]')
    .slice(0, max);
  return {
    stage: clean(error?.ydbStage || 'unknown', 32),
    name: clean(error?.name || 'Error', 80),
    code: clean(error?.code || error?.statusCode || '', 80),
    message: clean(error?.message || 'No error message.'),
  };
}

function createHandler({ env = process.env, fetchImpl = globalThis.fetch, telegramTimeoutMs = 8000, leadStore } = {}) {
  const store = leadStore || createYdbStore({ env });
  return async function handler(event, context = {}) {
    const relayMode = env.DELIVERY_MODE === 'cloudflare-relay';
    const headers = Object.fromEntries(Object.entries(event?.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
    const origin = headers.origin;
    const cors = allowedOrigins.has(origin) ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
    } : {};
    const reply = (statusCode, body) => ({
      statusCode,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin', ...cors },
      isBase64Encoded: false,
      body: statusCode === 204 ? '' : JSON.stringify(body),
    });
    // The direct Yandex invocation URL is both the GET health check and POST endpoint.
    if (event?.httpMethod === 'GET') return reply(200, {
      ok: true, service: 'photoprobiz-leads', provider: 'yandex-cloud',
      storage: 'ydb', databaseConfigured: store.databaseConfigured(),
      deliveryMode: relayMode ? 'cloudflare-relay' : 'telegram',
      telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN?.trim() && env.TELEGRAM_CHAT_ID?.trim()),
    });
    if (!allowedOrigins.has(origin)) return reply(403, { error: 'Origin is not allowed.' });
    if (event?.httpMethod === 'OPTIONS') return reply(204);
    if (event?.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed.' });
    if (!/^application\/json(?:\s*;|$)/i.test(headers['content-type'] || '')) return reply(415, { error: 'Content-Type must be application/json.' });
    if (typeof event.body !== 'string') return reply(400, { error: 'Invalid JSON.' });
    if (Buffer.byteLength(event.body) > MAX_BODY_BYTES * (event.isBase64Encoded ? 2 : 1)) return reply(413, { error: 'Request is too large.' });
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return reply(413, { error: 'Request is too large.' });
    let payload;
    try { payload = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid JSON.' }); }
    const lead = parseLead(payload);
    if (!lead) return reply(400, { error: 'Invalid lead data.' });
    const serverReceivedAt = new Date().toISOString();
    try {
      await store.save(lead, serverReceivedAt, context?.token?.access_token);
    } catch (error) {
      const diagnostic = safeYdbDiagnostic(error);
      console.error('YDB_OPERATION_FAILED', diagnostic);
      const stageCodes = {
        connection: 'DATABASE_CONNECTION_FAILED',
        schema: 'DATABASE_SCHEMA_FAILED',
        write: 'DATABASE_WRITE_FAILED',
      };
      return reply(error?.code === 'YDB_NOT_CONFIGURED' ? 503 : 502, {
        error: 'Could not store the lead.',
        code: error?.code === 'YDB_NOT_CONFIGURED' ? 'DATABASE_NOT_CONFIGURED' : (stageCodes[diagnostic.stage] || 'DATABASE_WRITE_FAILED'),
      });
    }

    // The browser contacts Yandex only. Existing Cloudflare delivery is called
    // server-to-server because direct Telegram connections time out in this runtime.
    // Do not retry via another route: a timed-out request may already be delivered.
    if (relayMode) {
      if (!env.RELAY_TOKEN?.trim()) {
        return reply(503, { error: 'Relay is not configured.', code: 'RELAY_NOT_CONFIGURED' });
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), telegramTimeoutMs);
      try {
        const response = await fetchImpl('https://api.photoprobiz.ru/lead', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', Origin: 'https://photoprobiz.ru',
            'X-Relay-Token': env.RELAY_TOKEN?.trim() || '',
          },
          body: JSON.stringify({
            event: 'new_lead', site: 'photoprobiz.ru',
            submissionId: lead.submissionId, serverReceivedAt,
          }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || result?.ok !== true) return reply(502, { error: 'Could not deliver the lead.', code: 'RELAY_DELIVERY_FAILED' });
        return reply(200, { ok: true });
      } catch {
        return reply(controller.signal.aborted ? 504 : 502, {
          error: 'Could not deliver the lead.',
          code: controller.signal.aborted ? 'RELAY_TIMEOUT' : 'RELAY_DELIVERY_FAILED',
        });
      } finally { clearTimeout(timer); }
    }
    const token = env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = env.TELEGRAM_CHAT_ID?.trim();
    if (!token || !chatId) return reply(503, { error: 'Telegram is not configured.', code: 'TELEGRAM_NOT_CONFIGURED' });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), telegramTimeoutMs);
    try {
      const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: notificationMessage(lead, serverReceivedAt) }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok || result?.ok !== true) return reply(502, { error: 'Could not deliver the lead.', code: 'TELEGRAM_DELIVERY_FAILED' });
      return reply(200, { ok: true });
    } catch {
      // Never log request data, Telegram responses, or errors containing the token URL.
      return reply(controller.signal.aborted ? 504 : 502, {
        error: 'Could not deliver the lead.',
        code: controller.signal.aborted ? 'TELEGRAM_TIMEOUT' : 'TELEGRAM_DELIVERY_FAILED',
      });
    } finally { clearTimeout(timer); }
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;

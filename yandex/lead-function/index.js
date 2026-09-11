'use strict';

const { randomUUID } = require('node:crypto');
const { createYdbStore } = require('./storage.js');
const { adminPage } = require('./admin-page.js');
const {
  configured: adminConfigured,
  createSession,
  isAuthorized,
  passwordMatches,
} = require('./admin-auth.js');

const methods = { phone: 'Телефон', telegram: 'Telegram', whatsapp: 'WhatsApp', max_messenger: 'Max' };
const sources = { modal: 'Всплывающая форма', inline: 'Форма на странице' };
const DEFAULT_SITE = {
  siteHost: 'photoprobiz.ru',
  label: 'Деловой фотограф',
  origins: [
    'https://photoprobiz.ru', 'https://www.photoprobiz.ru',
    'https://kuznetsovphotographer-prog.github.io',
    'http://127.0.0.1:4173', 'http://127.0.0.1:5173',
    'http://localhost:4173', 'http://localhost:5173',
  ],
  consentVersions: ['2026-09-11'],
  packages: ['Минимальный', 'Базовый', 'Полный'],
  formIds: ['homepage-inline', 'modal-general', 'modal-package-minimal', 'modal-package-base', 'modal-package-full'],
};
const MAX_BODY_BYTES = 8192;
const ADMIN_STATUSES = new Set(['new', 'contacted', 'closed']);
const HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function siteConfigurations(env = process.env) {
  let custom = [];
  try {
    const value = env.CRM_SITES_JSON?.trim();
    if (value) custom = JSON.parse(value);
  } catch { custom = []; }
  if (!Array.isArray(custom)) custom = [];
  const normalized = custom.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const siteHost = typeof item.siteHost === 'string' ? item.siteHost.trim().toLowerCase() : '';
    const label = typeof item.label === 'string' ? item.label.trim().slice(0, 80) : '';
    const origins = Array.isArray(item.origins) ? item.origins.filter((value) => {
      try {
        const url = new URL(value);
        return url.origin === value && (url.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname));
      } catch { return false; }
    }) : [];
    const consentVersions = Array.isArray(item.consentVersions)
      ? item.consentVersions.filter((value) => typeof value === 'string' && /^[A-Za-z0-9._-]{1,40}$/.test(value)) : [];
    const formIds = Array.isArray(item.formIds)
      ? item.formIds.filter((value) => typeof value === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(value)) : [];
    const packages = Array.isArray(item.packages)
      ? item.packages.filter((value) => typeof value === 'string' && value.trim() && value.length <= 120) : [];
    if (!HOST_PATTERN.test(siteHost) || !label || !origins.length || !consentVersions.length) return null;
    return { siteHost, label, origins, consentVersions, formIds, packages };
  }).filter(Boolean);
  const byOrigin = new Map();
  for (const config of [DEFAULT_SITE, ...normalized]) for (const origin of config.origins) byOrigin.set(origin, config);
  return [...new Set(byOrigin.values())];
}

function siteForOrigin(origin, configuredSites) {
  for (const site of configuredSites) if (site.origins.includes(origin)) return site;
  return null;
}

function crmSites(configuredSites, storedHosts = []) {
  const labels = new Map([['manual.crm', 'Внесены вручную'], ...configuredSites.map((site) => [site.siteHost, site.label])]);
  const hosts = new Set([...configuredSites.map((site) => site.siteHost), 'manual.crm', ...storedHosts]);
  return [...hosts].filter((host) => HOST_PATTERN.test(host)).sort().map((host) => ({ host, label: labels.get(host) || host }));
}

function parseManualLead(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const contact = typeof value.phone === 'string' ? value.phone.trim() : '';
  const manualSource = typeof value.manualSource === 'string' ? value.manualSource.trim() : '';
  const notes = typeof value.notes === 'string' ? value.notes.trim() : '';
  if (!name || name.length > 100 || !/[\p{L}]/u.test(name) || /[<>\r\n]/u.test(name)) return null;
  if (!/^\+\d{10,15}$/.test(contact) || !Object.hasOwn(methods, value.contactMethod)) return null;
  if (!manualSource || manualSource.length > 120 || /[<>\r\n]/u.test(manualSource)) return null;
  if (notes.length > 3000 || /[<>]/u.test(notes)) return null;
  return { name, contact, contactMethod: value.contactMethod, manualSource, notes, submissionId: randomUUID() };
}

function parseLead(value, site = DEFAULT_SITE) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const contact = typeof value.contact === 'string' ? value.contact.trim() : '';
  if (!name || name.length > 100 || !/[\p{L}]/u.test(name) || /[\d<>\r\n]/u.test(name)) return null;
  if (!/^\+\d{10,15}$/.test(contact) || value.consent !== true) return null;
  if (!Object.hasOwn(methods, value.contactMethod) || !Object.hasOwn(sources, value.source)) return null;
  if (value.packageName !== undefined && (typeof value.packageName !== 'string' || !value.packageName.trim() || value.packageName.length > 120)) return null;
  if (value.packageName !== undefined && site.packages.length && !site.packages.includes(value.packageName)) return null;
  if (value.phoneCountry !== undefined && (typeof value.phoneCountry !== 'string' || !/^[A-Za-z]{2}$/.test(value.phoneCountry))) return null;
  if (!site.consentVersions.includes(value.consentVersion)) return null;
  if (typeof value.formId !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/.test(value.formId)) return null;
  if (site.formIds.length && !site.formIds.includes(value.formId)) return null;
  if (typeof value.submissionId !== 'string' || !/^[A-Za-z0-9-]{16,80}$/.test(value.submissionId)) return null;
  if (typeof value.consentAcceptedAt !== 'string' || !Number.isFinite(Date.parse(value.consentAcceptedAt))) return null;
  return {
    name, contact, contactMethod: value.contactMethod, source: value.source,
    packageName: value.packageName, phoneCountry: value.phoneCountry,
    consentVersion: value.consentVersion, consentAcceptedAt: value.consentAcceptedAt,
    submissionId: value.submissionId, formId: value.formId,
  };
}

function notificationMessage(lead, serverReceivedAt, siteHost) {
  return [
    `Новая заявка с сайта ${siteHost}`, '',
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

function queryParams(event) {
  if (event?.queryStringParameters && typeof event.queryStringParameters === 'object') {
    return event.queryStringParameters;
  }
  try { return Object.fromEntries(new URL(event?.url || '/', 'https://functions.yandexcloud.net').searchParams); } catch { return {}; }
}

function parseJsonBody(event, maxBytes = MAX_BODY_BYTES) {
  if (typeof event?.body !== 'string') return null;
  if (Buffer.byteLength(event.body) > maxBytes * (event.isBase64Encoded ? 2 : 1)) return null;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  if (Buffer.byteLength(raw) > maxBytes) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

function publicLead(row) {
  return {
    submissionId: String(row?.submission_id || ''),
    serverReceivedAt: iso(row?.server_received_at),
    consentAcceptedAt: iso(row?.consent_accepted_at),
    consentVersion: String(row?.consent_version || ''),
    formId: String(row?.form_id || ''),
    source: String(row?.source || ''),
    siteHost: String(row?.site_host || ''),
    name: String(row?.name || ''),
    phone: String(row?.phone || ''),
    contactMethod: String(row?.contact_method || ''),
    packageName: String(row?.package_name || ''),
    phoneCountry: String(row?.phone_country || ''),
    status: ADMIN_STATUSES.has(row?.status) ? row.status : 'new',
    expiresAt: iso(row?.expires_at),
    notes: String(row?.notes || ''),
    manualSource: String(row?.manual_source || ''),
  };
}

function decodeCursor(value) {
  if (!value || typeof value !== 'string' || value.length > 300) return undefined;
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!Number.isFinite(Date.parse(cursor.receivedAt)) || !/^[A-Za-z0-9-]{16,80}$/.test(cursor.submissionId)) return undefined;
    return cursor;
  } catch { return undefined; }
}

function createHandler({ env = process.env, fetchImpl = globalThis.fetch, telegramTimeoutMs = 8000, leadStore } = {}) {
  const store = leadStore || createYdbStore({ env });
  const configuredSites = siteConfigurations(env);
  return async function handler(event, context = {}) {
    const relayMode = env.DELIVERY_MODE === 'cloudflare-relay';
    const headers = Object.fromEntries(Object.entries(event?.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
    const params = queryParams(event);
    const origin = headers.origin;
    const currentSite = siteForOrigin(origin, configuredSites);
    const cors = currentSite ? {
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

    const adminReply = (statusCode, body, extraHeaders = {}) => ({
      statusCode,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        Pragma: 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        ...extraHeaders,
      },
      isBase64Encoded: false,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

    if (params.admin === '1' && event?.httpMethod === 'GET') {
      return adminReply(200, adminPage(), {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      });
    }

    if (params.admin_api) {
      const adminBaseOrigin = (() => { try { return new URL(env.ADMIN_BASE_URL).origin; } catch { return ''; } })();
      if (event?.httpMethod === 'POST' && (!adminBaseOrigin || origin !== adminBaseOrigin)) {
        return adminReply(403, { error: 'Request origin is not allowed.' });
      }
      if (!adminConfigured(env)) return adminReply(503, { error: 'Admin access is not configured.' });
      if (params.admin_api === 'login' && event?.httpMethod === 'POST') {
        const payload = parseJsonBody(event, 2048);
        if (!payload || typeof payload.password !== 'string' || payload.password.length > 200
          || !passwordMatches(payload.password, env.ADMIN_PASSWORD_SCRYPT)) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          return adminReply(401, { error: 'Invalid credentials.' });
        }
        const token = createSession(env.ADMIN_SESSION_SECRET.trim());
        return adminReply(200, { ok: true, session: token });
      }
      if (params.admin_api === 'logout' && event?.httpMethod === 'POST') {
        return adminReply(200, { ok: true });
      }
      if (params.admin_api === 'session' && event?.httpMethod === 'GET') {
        const authenticated = isAuthorized(headers, env);
        return adminReply(200, {
          authenticated,
          ...(authenticated ? { session: createSession(env.ADMIN_SESSION_SECRET.trim()) } : {}),
        });
      }
      if (!isAuthorized(headers, env)) return adminReply(401, { error: 'Authentication required.' });
      const renewedSession = createSession(env.ADMIN_SESSION_SECRET.trim());
      if (params.admin_api === 'leads' && event?.httpMethod === 'GET') {
        try {
          const siteHost = typeof params.site === 'string' && HOST_PATTERN.test(params.site) ? params.site.toLowerCase() : '';
          const result = await store.list(context?.token?.access_token, {
            limit: Math.min(Number(params.limit) || 50, 100),
            cursor: decodeCursor(params.cursor),
            siteHost,
          });
          return adminReply(200, { leads: result.rows.map(publicLead), hasMore: result.hasMore, session: renewedSession });
        } catch (error) {
          console.error('YDB_ADMIN_OPERATION_FAILED', safeYdbDiagnostic(error));
          return adminReply(502, { error: 'Could not load leads.' });
        }
      }
      if (params.admin_api === 'sites' && event?.httpMethod === 'GET') {
        try {
          const storedHosts = typeof store.sites === 'function' ? await store.sites(context?.token?.access_token) : [];
          return adminReply(200, { sites: crmSites(configuredSites, storedHosts), session: renewedSession });
        } catch (error) {
          console.error('YDB_ADMIN_OPERATION_FAILED', safeYdbDiagnostic(error));
          return adminReply(502, { error: 'Could not load sites.' });
        }
      }
      if (params.admin_api === 'lead' && event?.httpMethod === 'GET') {
        if (!/^[A-Za-z0-9-]{16,80}$/.test(params.id || '')) return adminReply(400, { error: 'Invalid lead ID.' });
        try {
          const row = await store.get(params.id, context?.token?.access_token);
          return row ? adminReply(200, { lead: publicLead(row), session: renewedSession }) : adminReply(404, { error: 'Lead not found.' });
        } catch (error) {
          console.error('YDB_ADMIN_OPERATION_FAILED', safeYdbDiagnostic(error));
          return adminReply(502, { error: 'Could not load lead.' });
        }
      }
      if (params.admin_api === 'status' && event?.httpMethod === 'POST') {
        const payload = parseJsonBody(event, 2048);
        if (!payload || !/^[A-Za-z0-9-]{16,80}$/.test(payload.submissionId || '') || !ADMIN_STATUSES.has(payload.status)) {
          return adminReply(400, { error: 'Invalid status update.' });
        }
        try {
          await store.updateStatus(payload.submissionId, payload.status, context?.token?.access_token);
          return adminReply(200, { ok: true, session: renewedSession });
        } catch (error) {
          console.error('YDB_ADMIN_OPERATION_FAILED', safeYdbDiagnostic(error));
          return adminReply(502, { error: 'Could not update status.' });
        }
      }
      if (params.admin_api === 'manual' && event?.httpMethod === 'POST') {
        const lead = parseManualLead(parseJsonBody(event, 8192));
        if (!lead) return adminReply(400, { error: 'Invalid manual lead.' });
        try {
          const serverReceivedAt = new Date().toISOString();
          await store.saveManual(lead, serverReceivedAt, context?.token?.access_token);
          const row = await store.get(lead.submissionId, context?.token?.access_token);
          return adminReply(201, { lead: publicLead(row), session: renewedSession });
        } catch (error) {
          console.error('YDB_ADMIN_OPERATION_FAILED', safeYdbDiagnostic(error));
          return adminReply(502, { error: 'Could not create lead.' });
        }
      }
      if (params.admin_api === 'notes' && event?.httpMethod === 'POST') {
        const payload = parseJsonBody(event, 8192);
        const notes = typeof payload?.notes === 'string' ? payload.notes.trim() : '';
        const manualSource = typeof payload?.manualSource === 'string' ? payload.manualSource.trim() : '';
        if (!/^[A-Za-z0-9-]{16,80}$/.test(payload?.submissionId || '') || notes.length > 3000 || manualSource.length > 120 || /[<>]/u.test(notes) || /[<>\r\n]/u.test(manualSource)) {
          return adminReply(400, { error: 'Invalid lead notes.' });
        }
        try {
          const updated = await store.updateMeta(payload.submissionId, notes, manualSource, context?.token?.access_token);
          return updated ? adminReply(200, { ok: true, session: renewedSession }) : adminReply(404, { error: 'Lead not found.' });
        } catch (error) {
          console.error('YDB_ADMIN_OPERATION_FAILED', safeYdbDiagnostic(error));
          return adminReply(502, { error: 'Could not update notes.' });
        }
      }
      return adminReply(404, { error: 'Admin endpoint not found.' });
    }

    // The direct Yandex invocation URL is both the GET health check and POST endpoint.
    if (event?.httpMethod === 'GET') return reply(200, {
      ok: true, service: 'photoprobiz-leads', provider: 'yandex-cloud',
      storage: 'ydb', databaseConfigured: store.databaseConfigured(),
      adminConfigured: adminConfigured(env),
      crmSitesConfigured: configuredSites.length,
      deliveryMode: relayMode ? 'cloudflare-relay' : 'telegram',
      telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN?.trim() && env.TELEGRAM_CHAT_ID?.trim()),
    });
    if (!currentSite) return reply(403, { error: 'Origin is not allowed.' });
    if (event?.httpMethod === 'OPTIONS') return reply(204);
    if (event?.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed.' });
    if (!/^application\/json(?:\s*;|$)/i.test(headers['content-type'] || '')) return reply(415, { error: 'Content-Type must be application/json.' });
    if (typeof event.body !== 'string') return reply(400, { error: 'Invalid JSON.' });
    if (Buffer.byteLength(event.body) > MAX_BODY_BYTES * (event.isBase64Encoded ? 2 : 1)) return reply(413, { error: 'Request is too large.' });
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return reply(413, { error: 'Request is too large.' });
    let payload;
    try { payload = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid JSON.' }); }
    const lead = parseLead(payload, currentSite);
    if (!lead) return reply(400, { error: 'Invalid lead data.' });
    const serverReceivedAt = new Date().toISOString();
    try {
      await store.save(lead, serverReceivedAt, context?.token?.access_token, currentSite.siteHost);
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
            event: 'new_lead', site: currentSite.siteHost,
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
        body: JSON.stringify({ chat_id: chatId, text: notificationMessage(lead, serverReceivedAt, currentSite.siteHost) }),
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
exports.crmSites = crmSites;
exports.parseLead = parseLead;
exports.parseManualLead = parseManualLead;
exports.siteConfigurations = siteConfigurations;

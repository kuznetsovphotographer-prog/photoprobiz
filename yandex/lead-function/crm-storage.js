'use strict';

const { createYdbStore, ensureTable, LEAD_META_COLUMNS, LEAD_META_TABLE, stageError } = require('./storage.js');

const INTERIORS_HOST = 'prointeriors.ru';
const INTERIORS_LABEL = 'Интерьерная съёмка';
const DATABASE_PATTERN = /^\/ru-central1\/[a-z0-9]+\/[a-z0-9]+$/;
const INTERIORS_SELECT = `
  l.submission_id AS submission_id, l.server_received_at AS server_received_at,
  c.consent_accepted_at AS consent_accepted_at, c.consent_version AS consent_version,
  c.form_id AS form_id, "estimate" AS source, l.site_host AS site_host,
  l.name AS name, l.phone AS phone, l.contact_method AS contact_method,
  l.estimate_json AS estimate_json, "" AS phone_country,
  COALESCE(l.device_type, "unknown") AS device_type,
  COALESCE(l.os_family, "unknown") AS os_family,
  l.status AS status, l.expires_at AS expires_at`;

function estimateLabel(value) {
  try {
    const estimate = JSON.parse(String(value || ''));
    const total = Number(estimate?.total);
    const parts = (Array.isArray(estimate?.items) ? estimate.items : []).map((item) => {
      const label = typeof item?.label === 'string' ? item.label.trim() : '';
      const quantity = Number(item?.quantity);
      return label ? `${label}${Number.isInteger(quantity) && quantity > 1 ? ` × ${quantity}` : ''}` : '';
    }).filter(Boolean);
    const totalLabel = Number.isFinite(total) && total >= 0 ? `≈ ${new Intl.NumberFormat('ru-RU').format(total)} ₽` : '';
    return [totalLabel, ...parts].filter(Boolean).join(' · ').slice(0, 500);
  } catch { return 'Предварительный расчёт'; }
}

function createInteriorsStore({ endpoint, database, sdk } = {}) {
  let driver;
  let readyPromise;
  let schemaPromise;
  let invocationToken;
  const configured = () => Boolean(endpoint?.trim() && database?.trim() && DATABASE_PATTERN.test(database.trim()));

  async function getDriver(accessToken) {
    if (!configured()) return null;
    if (!accessToken || typeof accessToken !== 'string') {
      throw stageError(Object.assign(new Error('Missing IAM token.'), { code: 'YDB_CONTEXT_TOKEN_MISSING' }), 'connection');
    }
    invocationToken = accessToken;
    if (!driver) {
      const ydb = sdk || require('ydb-sdk');
      const authService = { getAuthMetadata: async () => new ydb.TokenAuthService(invocationToken).getAuthMetadata() };
      driver = new ydb.Driver({ endpoint: endpoint.trim(), database: database.trim(), authService,
        poolSettings: { minLimit: 0, maxLimit: 4 } });
      readyPromise = driver.ready(8000).then((ready) => {
        if (!ready) throw new Error('YDB driver did not become ready.');
        return driver;
      }).catch((error) => { throw stageError(error, 'connection'); });
    }
    return readyPromise;
  }

  async function ensureMeta(active) {
    if (!schemaPromise) {
      const ydb = sdk || require('ydb-sdk');
      schemaPromise = active.tableClient.withSessionRetry((session) =>
        ensureTable(session, ydb, LEAD_META_TABLE, LEAD_META_COLUMNS), 10000
      ).catch((error) => { schemaPromise = undefined; throw stageError(error, 'schema'); });
    }
    return schemaPromise;
  }

  function nativeRows(ydb, result) {
    const set = result?.resultSets?.[0];
    if (!set) return [];
    return ydb.TypedData.createNativeObjects(set).map((row) => ({ ...row,
      package_name: estimateLabel(row.estimate_json), notes: String(row.notes || ''),
      manual_source: String(row.manual_source || '') }));
  }

  async function run(accessToken, callback, stage = 'read') {
    const active = await getDriver(accessToken);
    if (!active) return null;
    await ensureMeta(active);
    try { return await active.tableClient.withSessionRetry(callback, 10000); }
    catch (error) { throw stageError(error, stage); }
  }

  async function list(accessToken, { limit = 50, cursor } = {}) {
    const ydb = sdk || require('ydb-sdk');
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
    const hasCursor = Boolean(cursor?.receivedAt && cursor?.submissionId);
    const result = await run(accessToken, async (session) => {
      const query = await session.prepareQuery(`
DECLARE $has_cursor AS Bool; DECLARE $before_at AS Timestamp; DECLARE $before_id AS Utf8;
SELECT ${INTERIORS_SELECT}, COALESCE(m.notes, "") AS notes, COALESCE(m.manual_source, "") AS manual_source
FROM leads AS l INNER JOIN consent_events AS c ON l.submission_id = c.submission_id
LEFT JOIN lead_meta AS m ON l.submission_id = m.submission_id
WHERE l.site_host = "${INTERIORS_HOST}" AND (NOT $has_cursor OR l.server_received_at < $before_at
  OR (l.server_received_at = $before_at AND l.submission_id < $before_id))
ORDER BY l.server_received_at DESC, l.submission_id DESC LIMIT ${safeLimit + 1};`);
      return session.executeQuery(query, {
        '$has_cursor': ydb.TypedValues.bool(hasCursor),
        '$before_at': ydb.TypedValues.timestamp(hasCursor ? new Date(cursor.receivedAt) : new Date(0)),
        '$before_id': ydb.TypedValues.utf8(hasCursor ? cursor.submissionId : ''),
      });
    });
    const rows = result ? nativeRows(ydb, result) : [];
    return { rows: rows.slice(0, safeLimit), hasMore: rows.length > safeLimit };
  }

  async function get(submissionId, accessToken) {
    const ydb = sdk || require('ydb-sdk');
    const result = await run(accessToken, async (session) => {
      const query = await session.prepareQuery(`DECLARE $submission_id AS Utf8;
SELECT ${INTERIORS_SELECT}, COALESCE(m.notes, "") AS notes, COALESCE(m.manual_source, "") AS manual_source
FROM leads AS l INNER JOIN consent_events AS c ON l.submission_id = c.submission_id
LEFT JOIN lead_meta AS m ON l.submission_id = m.submission_id
WHERE l.submission_id = $submission_id AND l.site_host = "${INTERIORS_HOST}" LIMIT 1;`);
      return session.executeQuery(query, { '$submission_id': ydb.TypedValues.utf8(submissionId) });
    });
    return result ? nativeRows(ydb, result)[0] || null : null;
  }

  async function updateStatus(submissionId, status, accessToken) {
    const ydb = sdk || require('ydb-sdk');
    await run(accessToken, async (session) => {
      const query = await session.prepareQuery('DECLARE $id AS Utf8; DECLARE $status AS Utf8; UPDATE leads SET status = $status WHERE submission_id = $id;');
      return session.executeQuery(query, { '$id': ydb.TypedValues.utf8(submissionId), '$status': ydb.TypedValues.utf8(status) });
    }, 'write');
  }

  async function updateMeta(submissionId, notes, manualSource, accessToken) {
    const ydb = sdk || require('ydb-sdk');
    const existing = await get(submissionId, accessToken);
    if (!existing) return false;
    await run(accessToken, async (session) => {
      const query = await session.prepareQuery(`DECLARE $id AS Utf8; DECLARE $notes AS Utf8; DECLARE $source AS Utf8;
DECLARE $updated AS Timestamp; DECLARE $expires AS Timestamp;
UPSERT INTO lead_meta (submission_id, notes, manual_source, updated_at, expires_at)
VALUES ($id, $notes, $source, $updated, $expires);`);
      return session.executeQuery(query, {
        '$id': ydb.TypedValues.utf8(submissionId), '$notes': ydb.TypedValues.utf8(notes),
        '$source': ydb.TypedValues.utf8(manualSource), '$updated': ydb.TypedValues.timestamp(new Date()),
        '$expires': ydb.TypedValues.timestamp(existing.expires_at instanceof Date ? existing.expires_at : new Date(existing.expires_at)),
      });
    }, 'write');
    return true;
  }
  return { configured, get, list, updateMeta, updateStatus };
}

function createCrmStore({ env = process.env, sdk, primaryStore, interiorsStore } = {}) {
  const primary = primaryStore || createYdbStore({ env, sdk });
  const interiors = interiorsStore || createInteriorsStore({ endpoint: env.ENDPOINT, database: env.PROINTERIORS_DATABASE, sdk });
  const enabled = () => interiors.configured();
  const owner = async (id, token) => {
    const [first, second] = await Promise.all([primary.get(id, token), enabled() ? interiors.get(id, token) : null]);
    if (first && second) throw stageError(Object.assign(new Error('Ambiguous lead ID.'), { code: 'AMBIGUOUS_LEAD_ID' }), 'read');
    return first ? { store: primary, row: first } : second ? { store: interiors, row: second } : null;
  };
  return {
    databaseConfigured: () => primary.databaseConfigured(), databaseCount: () => enabled() ? 2 : 1,
    siteLabels: () => enabled() ? { [INTERIORS_HOST]: INTERIORS_LABEL } : {},
    save: (...args) => primary.save(...args), saveManual: (...args) => primary.saveManual(...args),
    async sites(token) { const hosts = await primary.sites(token); return enabled() ? [...new Set([...hosts, INTERIORS_HOST])] : hosts; },
    async list(token, options = {}) {
      if (options.siteHost === INTERIORS_HOST) return enabled() ? interiors.list(token, options) : { rows: [], hasMore: false };
      if (options.siteHost) return primary.list(token, options);
      const results = await Promise.all([primary.list(token, options), ...(enabled() ? [interiors.list(token, options)] : [])]);
      const limit = Math.max(1, Math.min(Number(options.limit) || 50, 100));
      const combined = results.flatMap((result) => result.rows).sort((a, b) => {
        const time = new Date(b.server_received_at).getTime() - new Date(a.server_received_at).getTime();
        return time || String(b.submission_id).localeCompare(String(a.submission_id));
      });
      return { rows: combined.slice(0, limit), hasMore: combined.length > limit || results.some((result) => result.hasMore) };
    },
    async get(id, token) { return (await owner(id, token))?.row || null; },
    async updateStatus(id, status, token) { const target = await owner(id, token); if (!target) return false; await target.store.updateStatus(id, status, token); return true; },
    async updateMeta(id, notes, source, token) { const target = await owner(id, token); return target ? target.store.updateMeta(id, notes, source, token) : false; },
  };
}

module.exports = { INTERIORS_HOST, INTERIORS_LABEL, INTERIORS_SELECT, createCrmStore, createInteriorsStore, estimateLabel };

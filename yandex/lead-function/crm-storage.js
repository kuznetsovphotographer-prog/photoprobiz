'use strict';

const { createYdbStore, ensureColumns, ensureTable, LEAD_META_COLUMNS, LEAD_META_TABLE, stageError } = require('./storage.js');

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
const INTERIORS_SELECT_EXISTING_IDS = 'DECLARE $ids AS List<Utf8>; SELECT submission_id FROM leads WHERE submission_id IN $ids;';
const INTERIORS_DELETE_LEADS = `DECLARE $ids AS List<Utf8>;
DELETE FROM lead_meta WHERE submission_id IN $ids;
DELETE FROM consent_events WHERE submission_id IN $ids;
DELETE FROM leads WHERE submission_id IN $ids;`;

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
      schemaPromise = active.tableClient.withSessionRetry(async (session) => {
        const metaDescription = await ensureTable(session, ydb, LEAD_META_TABLE, LEAD_META_COLUMNS);
        await ensureColumns(session, ydb, LEAD_META_TABLE, [['revenue_rub', 'UINT64']], metaDescription);
      }, 10000).catch((error) => { schemaPromise = undefined; throw stageError(error, 'schema'); });
    }
    return schemaPromise;
  }

  function nativeRows(ydb, result) {
    const set = result?.resultSets?.[0];
    if (!set) return [];
    return ydb.TypedData.createNativeObjects(set).map((row) => ({ ...row,
      package_name: estimateLabel(row.estimate_json), notes: String(row.notes || ''),
      manual_source: String(row.manual_source || ''), revenue_rub: Number(row.revenue_rub || 0) }));
  }

  async function run(accessToken, callback, stage = 'read') {
    const active = await getDriver(accessToken);
    if (!active) return null;
    await ensureMeta(active);
    try { return await active.tableClient.withSessionRetry(callback, 10000); }
    catch (error) { throw stageError(error, stage); }
  }

  async function list(accessToken, { limit = 50, cursor, period } = {}) {
    const ydb = sdk || require('ydb-sdk');
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
    const hasCursor = Boolean(cursor?.receivedAt && cursor?.submissionId);
    const hasPeriod = Boolean(period?.from && period?.to);
    const result = await run(accessToken, async (session) => {
      const query = await session.prepareQuery(`
DECLARE $has_cursor AS Bool; DECLARE $before_at AS Timestamp; DECLARE $before_id AS Utf8;
DECLARE $has_period AS Bool; DECLARE $period_from AS Timestamp; DECLARE $period_to AS Timestamp;
SELECT ${INTERIORS_SELECT}, COALESCE(m.notes, "") AS notes, COALESCE(m.manual_source, "") AS manual_source,
COALESCE(m.revenue_rub, CAST(0 AS Uint64)) AS revenue_rub
FROM leads AS l INNER JOIN consent_events AS c ON l.submission_id = c.submission_id
LEFT JOIN lead_meta AS m ON l.submission_id = m.submission_id
WHERE l.site_host = "${INTERIORS_HOST}"
AND (NOT $has_period OR (l.server_received_at >= $period_from AND l.server_received_at < $period_to))
AND (NOT $has_cursor OR l.server_received_at < $before_at
  OR (l.server_received_at = $before_at AND l.submission_id < $before_id))
ORDER BY l.server_received_at DESC, l.submission_id DESC LIMIT ${safeLimit + 1};`);
      return session.executeQuery(query, {
        '$has_cursor': ydb.TypedValues.bool(hasCursor),
        '$before_at': ydb.TypedValues.timestamp(hasCursor ? new Date(cursor.receivedAt) : new Date(0)),
        '$before_id': ydb.TypedValues.utf8(hasCursor ? cursor.submissionId : ''),
        '$has_period': ydb.TypedValues.bool(hasPeriod),
        '$period_from': ydb.TypedValues.timestamp(hasPeriod ? new Date(period.from) : new Date(0)),
        '$period_to': ydb.TypedValues.timestamp(hasPeriod ? new Date(period.to) : new Date(0)),
      });
    });
    const rows = result ? nativeRows(ydb, result) : [];
    return { rows: rows.slice(0, safeLimit), hasMore: rows.length > safeLimit };
  }

  async function get(submissionId, accessToken) {
    const ydb = sdk || require('ydb-sdk');
    const result = await run(accessToken, async (session) => {
      const query = await session.prepareQuery(`DECLARE $submission_id AS Utf8;
SELECT ${INTERIORS_SELECT}, COALESCE(m.notes, "") AS notes, COALESCE(m.manual_source, "") AS manual_source,
COALESCE(m.revenue_rub, CAST(0 AS Uint64)) AS revenue_rub
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

  async function updateMeta(submissionId, notes, manualSource, revenueRub, accessToken) {
    const ydb = sdk || require('ydb-sdk');
    const existing = await get(submissionId, accessToken);
    if (!existing) return false;
    await run(accessToken, async (session) => {
      const query = await session.prepareQuery(`DECLARE $id AS Utf8; DECLARE $notes AS Utf8; DECLARE $source AS Utf8; DECLARE $revenue AS Uint64;
DECLARE $updated AS Timestamp; DECLARE $expires AS Timestamp;
UPSERT INTO lead_meta (submission_id, notes, manual_source, revenue_rub, updated_at, expires_at)
VALUES ($id, $notes, $source, $revenue, $updated, $expires);`);
      return session.executeQuery(query, {
        '$id': ydb.TypedValues.utf8(submissionId), '$notes': ydb.TypedValues.utf8(notes),
        '$source': ydb.TypedValues.utf8(manualSource), '$revenue': ydb.TypedValues.uint64(revenueRub),
        '$updated': ydb.TypedValues.timestamp(new Date()),
        '$expires': ydb.TypedValues.timestamp(existing.expires_at instanceof Date ? existing.expires_at : new Date(existing.expires_at)),
      });
    }, 'write');
    return true;
  }

  async function periods(accessToken) {
    const ydb = sdk || require('ydb-sdk');
    const result = await run(accessToken, async (session) => {
      const query = await session.prepareQuery(`SELECT server_received_at FROM leads
WHERE site_host = "${INTERIORS_HOST}" ORDER BY server_received_at DESC;`);
      return session.executeQuery(query);
    });
    return result ? nativeRows(ydb, result).map((row) => row.server_received_at) : [];
  }

  async function existingIds(submissionIds, accessToken) {
    if (!submissionIds.length) return [];
    const ydb = sdk || require('ydb-sdk');
    const result = await run(accessToken, async (session) => {
      const query = await session.prepareQuery(INTERIORS_SELECT_EXISTING_IDS);
      return session.executeQuery(query, { '$ids': ydb.TypedValues.list(ydb.Types.UTF8, submissionIds) });
    });
    return result ? nativeRows(ydb, result).map((row) => String(row.submission_id)) : [];
  }

  async function deleteMany(submissionIds, accessToken) {
    if (!submissionIds.length) return;
    const ydb = sdk || require('ydb-sdk');
    await run(accessToken, async (session) => {
      const query = await session.prepareQuery(INTERIORS_DELETE_LEADS);
      return session.executeQuery(query, { '$ids': ydb.TypedValues.list(ydb.Types.UTF8, submissionIds) });
    }, 'write');
  }
  return { configured, deleteMany, existingIds, get, list, periods, updateMeta, updateStatus };
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
    async periods(token, options = {}) {
      if (options.siteHost === INTERIORS_HOST) return enabled() ? interiors.periods(token) : [];
      if (options.siteHost) return primary.periods(token, options);
      const values = await Promise.all([primary.periods(token, options), ...(enabled() ? [interiors.periods(token)] : [])]);
      return values.flat();
    },
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
    async updateMeta(id, notes, source, revenueRub, token) { const target = await owner(id, token); return target ? target.store.updateMeta(id, notes, source, revenueRub, token) : false; },
    async deleteMany(ids, token) {
      const [primaryIds, interiorIds] = await Promise.all([
        primary.existingIds(ids, token),
        enabled() ? interiors.existingIds(ids, token) : [],
      ]);
      const primarySet = new Set(primaryIds);
      const interiorSet = new Set(interiorIds);
      const collision = ids.find((id) => primarySet.has(id) && interiorSet.has(id));
      if (collision) {
        throw stageError(Object.assign(new Error('Ambiguous lead ID.'), { code: 'AMBIGUOUS_LEAD_ID' }), 'read');
      }
      const groups = [
        { ids: ids.filter((id) => primarySet.has(id)), store: primary },
        { ids: ids.filter((id) => interiorSet.has(id)), store: interiors },
      ].filter((group) => group.ids.length);
      const results = await Promise.allSettled(groups.map((group) => group.store.deleteMany(group.ids, token)));
      const deleted = new Set(ids.filter((id) => !primarySet.has(id) && !interiorSet.has(id)));
      const failed = new Set();
      results.forEach((result, index) => {
        groups[index].ids.forEach((id) => (result.status === 'fulfilled' ? deleted : failed).add(id));
      });
      return { deletedIds: ids.filter((id) => deleted.has(id)), failedIds: ids.filter((id) => failed.has(id)) };
    },
  };
}

module.exports = { INTERIORS_DELETE_LEADS, INTERIORS_HOST, INTERIORS_LABEL, INTERIORS_SELECT, INTERIORS_SELECT_EXISTING_IDS, createCrmStore, createInteriorsStore, estimateLabel };

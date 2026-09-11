'use strict';

const CHECKS_TABLE = 'monitoring_checks';
const STATE_TABLE = 'monitoring_state';

const CHECK_COLUMNS = [
  ['check_id', 'UTF8'], ['checked_at', 'TIMESTAMP'], ['target', 'UTF8'],
  ['target_url', 'UTF8'], ['ok', 'BOOL'], ['status_code', 'INT32'],
  ['duration_ms', 'INT64'], ['error', 'UTF8'], ['expires_at', 'TIMESTAMP'],
];
const STATE_COLUMNS = [
  ['target', 'UTF8'], ['last_checked_at', 'TIMESTAMP'], ['last_ok', 'BOOL'],
  ['consecutive_failures', 'UINT32'], ['incident_open', 'BOOL'], ['alert_sent', 'BOOL'],
  ['incident_started_at', 'TIMESTAMP'], ['last_notified_at', 'TIMESTAMP'],
  ['last_status_code', 'INT32'], ['last_duration_ms', 'INT64'], ['last_error', 'UTF8'],
  ['last_daily_date', 'UTF8'],
];

function stageError(error, stage) {
  if (error && typeof error === 'object') { error.ydbStage = error.ydbStage || stage; return error; }
  const wrapped = new Error('Unknown YDB failure.');
  wrapped.ydbStage = stage;
  return wrapped;
}

function tableDescription(ydb, columns, primaryKey, ttlColumn) {
  const description = new ydb.TableDescription();
  for (const [name, type] of columns) description.withColumn(new ydb.Column(name, ydb.Types[type]));
  description.withPrimaryKey(primaryKey);
  return ttlColumn ? description.withTtl(ttlColumn, 0) : description;
}

function errorStatus(error) { return error?.status ?? error?.code ?? error?.constructor?.status; }

async function ensureTable(session, ydb, tableName, columns, primaryKey, ttlColumn) {
  try { await session.describeTable(tableName); return; } catch (error) {
    const status = errorStatus(error);
    if (status !== ydb.StatusCode.NOT_FOUND && status !== ydb.StatusCode.SCHEME_ERROR) throw error;
  }
  try { await session.createTable(tableName, tableDescription(ydb, columns, primaryKey, ttlColumn)); } catch (error) {
    const status = errorStatus(error);
    if (status !== ydb.StatusCode.ALREADY_EXISTS && !/already exists|path exists|уже существует/i.test(String(error?.message))) throw error;
  }
}

function createMonitorStore({ env = process.env, sdk } = {}) {
  let driver;
  let readyPromise;
  let schemaPromise;
  let invocationToken;

  async function getDriver(accessToken) {
    if (!env.ENDPOINT?.trim() || !env.DATABASE?.trim()) throw Object.assign(new Error('YDB is not configured.'), { code: 'YDB_NOT_CONFIGURED' });
    if (!accessToken) throw stageError(new Error('Service account token is missing.'), 'connection');
    invocationToken = accessToken;
    if (!driver) {
      const ydb = sdk || require('ydb-sdk');
      const authService = { getAuthMetadata: async () => new ydb.TokenAuthService(invocationToken).getAuthMetadata() };
      driver = new ydb.Driver({
        endpoint: env.ENDPOINT.trim(), database: env.DATABASE.trim(), authService,
        poolSettings: { minLimit: 0, maxLimit: 3 },
      });
      readyPromise = driver.ready(8000).then((ready) => {
        if (!ready) throw new Error('YDB driver did not become ready.');
        return driver;
      }).catch((error) => { throw stageError(error, 'connection'); });
    }
    return readyPromise;
  }

  async function ensureSchema(activeDriver) {
    if (!schemaPromise) {
      const ydb = sdk || require('ydb-sdk');
      schemaPromise = activeDriver.tableClient.withSessionRetry(async (session) => {
        await ensureTable(session, ydb, CHECKS_TABLE, CHECK_COLUMNS, 'check_id', 'expires_at');
        await ensureTable(session, ydb, STATE_TABLE, STATE_COLUMNS, 'target');
      }, 10000).catch((error) => { schemaPromise = undefined; throw stageError(error, 'schema'); });
    }
    return schemaPromise;
  }

  function nativeRows(ydb, result) {
    const resultSet = result?.resultSets?.[0];
    return resultSet ? ydb.TypedData.createNativeObjects(resultSet).map((row) => ({ ...row })) : [];
  }

  async function session(accessToken, callback, stage = 'read') {
    const activeDriver = await getDriver(accessToken);
    await ensureSchema(activeDriver);
    try { return await activeDriver.tableClient.withSessionRetry(callback, 10000); }
    catch (error) { throw stageError(error, stage); }
  }

  async function getState(target, accessToken) {
    const ydb = sdk || require('ydb-sdk');
    return session(accessToken, async (activeSession) => {
      const query = await activeSession.prepareQuery(`
DECLARE $target AS Utf8;
SELECT target, last_checked_at, last_ok, consecutive_failures, incident_open,
       alert_sent, incident_started_at, last_notified_at, last_status_code,
       last_duration_ms, last_error, last_daily_date
FROM ${STATE_TABLE} WHERE target = $target LIMIT 1;`);
      const result = await activeSession.executeQuery(query, { '$target': ydb.TypedValues.utf8(target) });
      return nativeRows(ydb, result)[0] || null;
    });
  }

  async function recordCheck(result, nextState, accessToken) {
    const ydb = sdk || require('ydb-sdk');
    const checkedAt = new Date(result.checkedAt);
    const expiresAt = new Date(checkedAt);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 180);
    return session(accessToken, async (activeSession) => {
      const query = await activeSession.prepareQuery(`
DECLARE $check_id AS Utf8; DECLARE $checked_at AS Timestamp; DECLARE $target AS Utf8;
DECLARE $target_url AS Utf8; DECLARE $ok AS Bool; DECLARE $status_code AS Int32;
DECLARE $duration_ms AS Int64; DECLARE $error AS Utf8; DECLARE $expires_at AS Timestamp;
DECLARE $consecutive_failures AS Uint32; DECLARE $incident_open AS Bool;
DECLARE $alert_sent AS Bool; DECLARE $incident_started_at AS Timestamp;
DECLARE $last_notified_at AS Timestamp; DECLARE $last_daily_date AS Utf8;
UPSERT INTO ${CHECKS_TABLE} (check_id, checked_at, target, target_url, ok, status_code, duration_ms, error, expires_at)
VALUES ($check_id, $checked_at, $target, $target_url, $ok, $status_code, $duration_ms, $error, $expires_at);
UPSERT INTO ${STATE_TABLE} (target, last_checked_at, last_ok, consecutive_failures, incident_open,
  alert_sent, incident_started_at, last_notified_at, last_status_code, last_duration_ms, last_error, last_daily_date)
VALUES ($target, $checked_at, $ok, $consecutive_failures, $incident_open, $alert_sent,
  $incident_started_at, $last_notified_at, $status_code, $duration_ms, $error, $last_daily_date);`);
      await activeSession.executeQuery(query, {
        '$check_id': ydb.TypedValues.utf8(`${result.checkedAt}:${result.target}`),
        '$checked_at': ydb.TypedValues.timestamp(checkedAt), '$target': ydb.TypedValues.utf8(result.target),
        '$target_url': ydb.TypedValues.utf8(result.url), '$ok': ydb.TypedValues.bool(result.ok),
        '$status_code': ydb.TypedValues.int32(result.statusCode), '$duration_ms': ydb.TypedValues.int64(result.durationMs),
        '$error': ydb.TypedValues.utf8(result.error || ''), '$expires_at': ydb.TypedValues.timestamp(expiresAt),
        '$consecutive_failures': ydb.TypedValues.uint32(nextState.consecutiveFailures),
        '$incident_open': ydb.TypedValues.bool(nextState.incidentOpen), '$alert_sent': ydb.TypedValues.bool(nextState.alertSent),
        '$incident_started_at': ydb.TypedValues.timestamp(new Date(nextState.incidentStartedAt)),
        '$last_notified_at': ydb.TypedValues.timestamp(new Date(nextState.lastNotifiedAt)),
        '$last_daily_date': ydb.TypedValues.utf8(nextState.lastDailyDate || ''),
      });
    }, 'write');
  }

  async function updateNotification(target, { alertSent, notifiedAt, dailyDate, incidentOpen = false, consecutiveFailures = 0 }, accessToken) {
    const ydb = sdk || require('ydb-sdk');
    return session(accessToken, async (activeSession) => {
      const query = await activeSession.prepareQuery(`
DECLARE $target AS Utf8; DECLARE $alert_sent AS Bool; DECLARE $last_notified_at AS Timestamp;
DECLARE $last_daily_date AS Utf8; DECLARE $incident_open AS Bool; DECLARE $consecutive_failures AS Uint32;
UPDATE ${STATE_TABLE} SET alert_sent = $alert_sent, last_notified_at = $last_notified_at,
last_daily_date = $last_daily_date, incident_open = $incident_open,
consecutive_failures = $consecutive_failures WHERE target = $target;`);
      await activeSession.executeQuery(query, {
        '$target': ydb.TypedValues.utf8(target), '$alert_sent': ydb.TypedValues.bool(Boolean(alertSent)),
        '$last_notified_at': ydb.TypedValues.timestamp(new Date(notifiedAt)),
        '$last_daily_date': ydb.TypedValues.utf8(dailyDate || ''),
        '$incident_open': ydb.TypedValues.bool(Boolean(incidentOpen)),
        '$consecutive_failures': ydb.TypedValues.uint32(consecutiveFailures),
      });
    }, 'write');
  }

  return { getState, recordCheck, updateNotification };
}

module.exports = { CHECKS_TABLE, STATE_TABLE, createMonitorStore, ensureTable, tableDescription };

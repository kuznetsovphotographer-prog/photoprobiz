'use strict';

const LEADS_TABLE = 'leads';
const CONSENT_TABLE = 'consent_events';
const LEAD_META_TABLE = 'lead_meta';

const LEADS_COLUMNS = [
  ['submission_id', 'UTF8'],
  ['server_received_at', 'TIMESTAMP'],
  ['consent_accepted_at', 'TIMESTAMP'],
  ['consent_version', 'UTF8'],
  ['form_id', 'UTF8'],
  ['source', 'UTF8'],
  ['site_host', 'UTF8'],
  ['name', 'UTF8'],
  ['phone', 'UTF8'],
  ['contact_method', 'UTF8'],
  ['package_name', 'UTF8'],
  ['phone_country', 'UTF8'],
  ['status', 'UTF8'],
  ['expires_at', 'TIMESTAMP'],
];

const CONSENT_COLUMNS = [
  ['submission_id', 'UTF8'],
  ['server_received_at', 'TIMESTAMP'],
  ['consent_accepted_at', 'TIMESTAMP'],
  ['consent_version', 'UTF8'],
  ['form_id', 'UTF8'],
  ['source', 'UTF8'],
  ['site_host', 'UTF8'],
  ['name', 'UTF8'],
  ['phone', 'UTF8'],
  ['expires_at', 'TIMESTAMP'],
];

const LEAD_META_COLUMNS = [
  ['submission_id', 'UTF8'],
  ['notes', 'UTF8'],
  ['manual_source', 'UTF8'],
  ['updated_at', 'TIMESTAMP'],
  ['expires_at', 'TIMESTAMP'],
];

const UPSERT_LEAD = `
DECLARE $submission_id AS Utf8;
DECLARE $server_received_at AS Timestamp;
DECLARE $consent_accepted_at AS Timestamp;
DECLARE $consent_version AS Utf8;
DECLARE $form_id AS Utf8;
DECLARE $source AS Utf8;
DECLARE $site_host AS Utf8;
DECLARE $name AS Utf8;
DECLARE $phone AS Utf8;
DECLARE $contact_method AS Utf8;
DECLARE $package_name AS Utf8;
DECLARE $phone_country AS Utf8;
DECLARE $lead_expires_at AS Timestamp;
DECLARE $consent_expires_at AS Timestamp;

UPSERT INTO ${LEADS_TABLE} (
  submission_id, server_received_at, consent_accepted_at, consent_version,
  form_id, source, site_host, name, phone, contact_method, package_name,
  phone_country, status, expires_at
) VALUES (
  $submission_id, $server_received_at, $consent_accepted_at, $consent_version,
  $form_id, $source, $site_host, $name, $phone, $contact_method, $package_name,
  $phone_country, "new", $lead_expires_at
);

UPSERT INTO ${CONSENT_TABLE} (
  submission_id, server_received_at, consent_accepted_at, consent_version,
  form_id, source, site_host, name, phone, expires_at
) VALUES (
  $submission_id, $server_received_at, $consent_accepted_at, $consent_version,
  $form_id, $source, $site_host, $name, $phone, $consent_expires_at
);`;

const LEAD_SELECT_COLUMNS = `
  submission_id, server_received_at, consent_accepted_at, consent_version,
  form_id, source, site_host, name, phone, contact_method, package_name,
  phone_country, status, expires_at`;

const LEAD_JOIN_SELECT_COLUMNS = `
  l.submission_id AS submission_id, l.server_received_at AS server_received_at,
  l.consent_accepted_at AS consent_accepted_at, l.consent_version AS consent_version,
  l.form_id AS form_id, l.source AS source, l.site_host AS site_host,
  l.name AS name, l.phone AS phone, l.contact_method AS contact_method,
  l.package_name AS package_name, l.phone_country AS phone_country,
  l.status AS status, l.expires_at AS expires_at`;

const GET_LEAD = `
DECLARE $submission_id AS Utf8;
SELECT ${LEAD_JOIN_SELECT_COLUMNS}
FROM ${LEADS_TABLE} AS l
WHERE l.submission_id = $submission_id
LIMIT 1;`;

const UPDATE_LEAD_STATUS = `
DECLARE $submission_id AS Utf8;
DECLARE $status AS Utf8;
UPDATE ${LEADS_TABLE}
SET status = $status
WHERE submission_id = $submission_id;`;

const UPSERT_LEAD_META = `
DECLARE $submission_id AS Utf8;
DECLARE $notes AS Utf8;
DECLARE $manual_source AS Utf8;
DECLARE $updated_at AS Timestamp;
DECLARE $expires_at AS Timestamp;
UPSERT INTO ${LEAD_META_TABLE} (submission_id, notes, manual_source, updated_at, expires_at)
VALUES ($submission_id, $notes, $manual_source, $updated_at, $expires_at);`;

const UPSERT_MANUAL_LEAD = `
DECLARE $submission_id AS Utf8;
DECLARE $server_received_at AS Timestamp;
DECLARE $site_host AS Utf8;
DECLARE $name AS Utf8;
DECLARE $phone AS Utf8;
DECLARE $contact_method AS Utf8;
DECLARE $expires_at AS Timestamp;
DECLARE $notes AS Utf8;
DECLARE $manual_source AS Utf8;

UPSERT INTO ${LEADS_TABLE} (
  submission_id, server_received_at, consent_accepted_at, consent_version,
  form_id, source, site_host, name, phone, contact_method, package_name,
  phone_country, status, expires_at
) VALUES (
  $submission_id, $server_received_at, $server_received_at, "",
  "crm-manual", "manual", $site_host, $name, $phone, $contact_method, "",
  "", "new", $expires_at
);

UPSERT INTO ${LEAD_META_TABLE} (submission_id, notes, manual_source, updated_at, expires_at)
VALUES ($submission_id, $notes, $manual_source, $server_received_at, $expires_at);`;

function addUtcYears(value, years) {
  const result = new Date(value);
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

function storageRecord(lead, serverReceivedAt, siteHost = 'photoprobiz.ru') {
  const receivedAt = new Date(serverReceivedAt);
  return {
    submissionId: lead.submissionId,
    serverReceivedAt: receivedAt,
    consentAcceptedAt: new Date(lead.consentAcceptedAt),
    consentVersion: lead.consentVersion,
    formId: lead.formId,
    source: lead.source,
    siteHost,
    name: lead.name,
    phone: lead.contact,
    contactMethod: lead.contactMethod,
    packageName: lead.packageName || '',
    phoneCountry: lead.phoneCountry || '',
    leadExpiresAt: addUtcYears(receivedAt, 1),
    consentExpiresAt: addUtcYears(receivedAt, 3),
  };
}

function stageError(error, stage) {
  if (error && typeof error === 'object') {
    error.ydbStage = error.ydbStage || stage;
    return error;
  }
  const wrapped = new Error('Unknown YDB failure.');
  wrapped.ydbStage = stage;
  return wrapped;
}

function tableDescription(ydb, columns) {
  const description = new ydb.TableDescription();
  for (const [name, type] of columns) {
    description.withColumn(new ydb.Column(name, ydb.Types[type]));
  }
  return description.withPrimaryKey('submission_id').withTtl('expires_at', 0);
}

function errorStatus(error) {
  return error?.status ?? error?.code ?? error?.constructor?.status;
}

async function ensureTable(session, ydb, tableName, columns) {
  try {
    await session.describeTable(tableName);
    return;
  } catch (error) {
    const status = errorStatus(error);
    if (status !== ydb.StatusCode.NOT_FOUND && status !== ydb.StatusCode.SCHEME_ERROR) {
      throw error;
    }
  }

  try {
    await session.createTable(tableName, tableDescription(ydb, columns));
  } catch (error) {
    const status = errorStatus(error);
    if (status !== ydb.StatusCode.ALREADY_EXISTS && !/already exists|path exists|уже существует/i.test(String(error?.message))) {
      throw error;
    }
  }
}

function createYdbStore({ env = process.env, sdk } = {}) {
  let driver;
  let readyPromise;
  let schemaPromise;
  let invocationToken;

  function databaseConfigured() {
    return Boolean(env.ENDPOINT?.trim() && env.DATABASE?.trim());
  }

  async function getDriver(accessToken) {
    if (!databaseConfigured()) {
      const error = new Error('YDB connection is not configured.');
      error.code = 'YDB_NOT_CONFIGURED';
      throw error;
    }
    if (!accessToken || typeof accessToken !== 'string') {
      const error = new Error('Yandex function context does not contain a service account token.');
      error.code = 'YDB_CONTEXT_TOKEN_MISSING';
      throw stageError(error, 'connection');
    }
    invocationToken = accessToken;
    if (!driver) {
      const ydb = sdk || require('ydb-sdk');
      const authService = {
        getAuthMetadata: async () => new ydb.TokenAuthService(invocationToken).getAuthMetadata(),
      };
      driver = new ydb.Driver({
        endpoint: env.ENDPOINT.trim(),
        database: env.DATABASE.trim(),
        authService,
        poolSettings: { minLimit: 0, maxLimit: 4 },
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
        await ensureTable(session, ydb, LEADS_TABLE, LEADS_COLUMNS);
        await ensureTable(session, ydb, CONSENT_TABLE, CONSENT_COLUMNS);
        await ensureTable(session, ydb, LEAD_META_TABLE, LEAD_META_COLUMNS);
      }, 10000).catch((error) => {
        schemaPromise = undefined;
        throw stageError(error, 'schema');
      });
    }
    await schemaPromise;
  }

  async function save(lead, serverReceivedAt, accessToken, siteHost = 'photoprobiz.ru') {
    const ydb = sdk || require('ydb-sdk');
    const activeDriver = await getDriver(accessToken);
    await ensureSchema(activeDriver);
    const record = storageRecord(lead, serverReceivedAt, siteHost);
    try {
      await activeDriver.tableClient.withSessionRetry(async (session) => {
        const query = await session.prepareQuery(UPSERT_LEAD);
        await session.executeQuery(query, {
        '$submission_id': ydb.TypedValues.utf8(record.submissionId),
        '$server_received_at': ydb.TypedValues.timestamp(record.serverReceivedAt),
        '$consent_accepted_at': ydb.TypedValues.timestamp(record.consentAcceptedAt),
        '$consent_version': ydb.TypedValues.utf8(record.consentVersion),
        '$form_id': ydb.TypedValues.utf8(record.formId),
        '$source': ydb.TypedValues.utf8(record.source),
        '$site_host': ydb.TypedValues.utf8(record.siteHost),
        '$name': ydb.TypedValues.utf8(record.name),
        '$phone': ydb.TypedValues.utf8(record.phone),
        '$contact_method': ydb.TypedValues.utf8(record.contactMethod),
        '$package_name': ydb.TypedValues.utf8(record.packageName),
        '$phone_country': ydb.TypedValues.utf8(record.phoneCountry),
        '$lead_expires_at': ydb.TypedValues.timestamp(record.leadExpiresAt),
        '$consent_expires_at': ydb.TypedValues.timestamp(record.consentExpiresAt),
        });
      }, 10000);
    } catch (error) {
      throw stageError(error, 'write');
    }
  }

  function nativeRows(ydb, result) {
    const resultSet = result?.resultSets?.[0];
    if (!resultSet) return [];
    return ydb.TypedData.createNativeObjects(resultSet).map((row) => ({ ...row }));
  }

  async function list(accessToken, { limit = 50, cursor, siteHost = '' } = {}) {
    const ydb = sdk || require('ydb-sdk');
    const activeDriver = await getDriver(accessToken);
    await ensureSchema(activeDriver);
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
    const hasCursor = Boolean(cursor?.receivedAt && cursor?.submissionId);
    const queryText = `
DECLARE $has_cursor AS Bool;
DECLARE $before_at AS Timestamp;
DECLARE $before_id AS Utf8;
DECLARE $site_host AS Utf8;
SELECT ${LEAD_JOIN_SELECT_COLUMNS}
  , COALESCE(m.notes, "") AS notes
  , COALESCE(m.manual_source, "") AS manual_source
FROM ${LEADS_TABLE} AS l
LEFT JOIN ${LEAD_META_TABLE} AS m ON l.submission_id = m.submission_id
WHERE ($site_host = "" OR l.site_host = $site_host)
  AND (
    NOT $has_cursor
    OR l.server_received_at < $before_at
    OR (l.server_received_at = $before_at AND l.submission_id < $before_id)
  )
ORDER BY l.server_received_at DESC, l.submission_id DESC
LIMIT ${safeLimit + 1};`;
    try {
      return await activeDriver.tableClient.withSessionRetry(async (session) => {
        const query = await session.prepareQuery(queryText);
        const result = await session.executeQuery(query, {
          '$has_cursor': ydb.TypedValues.bool(hasCursor),
          '$before_at': ydb.TypedValues.timestamp(hasCursor ? new Date(cursor.receivedAt) : new Date(0)),
          '$before_id': ydb.TypedValues.utf8(hasCursor ? cursor.submissionId : ''),
          '$site_host': ydb.TypedValues.utf8(siteHost),
        });
        const rows = nativeRows(ydb, result);
        return { rows: rows.slice(0, safeLimit), hasMore: rows.length > safeLimit };
      }, 10000);
    } catch (error) {
      throw stageError(error, 'read');
    }
  }

  async function sites(accessToken) {
    const ydb = sdk || require('ydb-sdk');
    const activeDriver = await getDriver(accessToken);
    await ensureSchema(activeDriver);
    const queryText = `SELECT DISTINCT site_host FROM ${LEADS_TABLE} ORDER BY site_host;`;
    try {
      return await activeDriver.tableClient.withSessionRetry(async (session) => {
        const query = await session.prepareQuery(queryText);
        const result = await session.executeQuery(query);
        return nativeRows(ydb, result)
          .map((row) => String(row.site_host || '').trim())
          .filter(Boolean);
      }, 10000);
    } catch (error) {
      throw stageError(error, 'read');
    }
  }

  async function get(submissionId, accessToken) {
    const ydb = sdk || require('ydb-sdk');
    const activeDriver = await getDriver(accessToken);
    await ensureSchema(activeDriver);
    try {
      return await activeDriver.tableClient.withSessionRetry(async (session) => {
        const query = await session.prepareQuery(`
DECLARE $submission_id AS Utf8;
SELECT ${LEAD_JOIN_SELECT_COLUMNS}
  , COALESCE(m.notes, "") AS notes
  , COALESCE(m.manual_source, "") AS manual_source
FROM ${LEADS_TABLE} AS l
LEFT JOIN ${LEAD_META_TABLE} AS m ON l.submission_id = m.submission_id
WHERE l.submission_id = $submission_id
LIMIT 1;`);
        const result = await session.executeQuery(query, {
          '$submission_id': ydb.TypedValues.utf8(submissionId),
        });
        return nativeRows(ydb, result)[0] || null;
      }, 10000);
    } catch (error) {
      throw stageError(error, 'read');
    }
  }

  async function saveManual(lead, serverReceivedAt, accessToken) {
    const ydb = sdk || require('ydb-sdk');
    const activeDriver = await getDriver(accessToken);
    await ensureSchema(activeDriver);
    const receivedAt = new Date(serverReceivedAt);
    const expiresAt = addUtcYears(receivedAt, 1);
    try {
      await activeDriver.tableClient.withSessionRetry(async (session) => {
        const query = await session.prepareQuery(UPSERT_MANUAL_LEAD);
        await session.executeQuery(query, {
          '$submission_id': ydb.TypedValues.utf8(lead.submissionId),
          '$server_received_at': ydb.TypedValues.timestamp(receivedAt),
          '$site_host': ydb.TypedValues.utf8('manual.crm'),
          '$name': ydb.TypedValues.utf8(lead.name),
          '$phone': ydb.TypedValues.utf8(lead.contact),
          '$contact_method': ydb.TypedValues.utf8(lead.contactMethod),
          '$expires_at': ydb.TypedValues.timestamp(expiresAt),
          '$notes': ydb.TypedValues.utf8(lead.notes || ''),
          '$manual_source': ydb.TypedValues.utf8(lead.manualSource || ''),
        });
      }, 10000);
    } catch (error) {
      throw stageError(error, 'write');
    }
  }

  async function updateMeta(submissionId, notes, manualSource, accessToken) {
    const ydb = sdk || require('ydb-sdk');
    const activeDriver = await getDriver(accessToken);
    await ensureSchema(activeDriver);
    const existing = await get(submissionId, accessToken);
    if (!existing) return false;
    try {
      await activeDriver.tableClient.withSessionRetry(async (session) => {
        const query = await session.prepareQuery(UPSERT_LEAD_META);
        await session.executeQuery(query, {
          '$submission_id': ydb.TypedValues.utf8(submissionId),
          '$notes': ydb.TypedValues.utf8(notes),
          '$manual_source': ydb.TypedValues.utf8(manualSource),
          '$updated_at': ydb.TypedValues.timestamp(new Date()),
          '$expires_at': ydb.TypedValues.timestamp(existing.expires_at instanceof Date ? existing.expires_at : new Date(existing.expires_at)),
        });
      }, 10000);
      return true;
    } catch (error) {
      throw stageError(error, 'write');
    }
  }

  async function updateStatus(submissionId, status, accessToken) {
    const ydb = sdk || require('ydb-sdk');
    const activeDriver = await getDriver(accessToken);
    await ensureSchema(activeDriver);
    try {
      await activeDriver.tableClient.withSessionRetry(async (session) => {
        const query = await session.prepareQuery(UPDATE_LEAD_STATUS);
        await session.executeQuery(query, {
          '$submission_id': ydb.TypedValues.utf8(submissionId),
          '$status': ydb.TypedValues.utf8(status),
        });
      }, 10000);
    } catch (error) {
      throw stageError(error, 'write');
    }
  }

  return { databaseConfigured, get, list, save, saveManual, sites, updateMeta, updateStatus };
}

module.exports = {
  CONSENT_COLUMNS,
  CONSENT_TABLE,
  GET_LEAD,
  LEADS_COLUMNS,
  LEADS_TABLE,
  LEAD_JOIN_SELECT_COLUMNS,
  LEAD_META_COLUMNS,
  LEAD_META_TABLE,
  LEAD_SELECT_COLUMNS,
  UPDATE_LEAD_STATUS,
  UPSERT_LEAD_META,
  UPSERT_MANUAL_LEAD,
  UPSERT_LEAD,
  addUtcYears,
  createYdbStore,
  ensureTable,
  errorStatus,
  storageRecord,
  tableDescription,
  stageError,
};

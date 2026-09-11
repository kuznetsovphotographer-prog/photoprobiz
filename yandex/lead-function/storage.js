'use strict';

const LEADS_TABLE = 'leads';
const CONSENT_TABLE = 'consent_events';

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

function addUtcYears(value, years) {
  const result = new Date(value);
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

function storageRecord(lead, serverReceivedAt) {
  const receivedAt = new Date(serverReceivedAt);
  return {
    submissionId: lead.submissionId,
    serverReceivedAt: receivedAt,
    consentAcceptedAt: new Date(lead.consentAcceptedAt),
    consentVersion: lead.consentVersion,
    formId: lead.formId,
    source: lead.source,
    siteHost: 'photoprobiz.ru',
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
      }, 10000).catch((error) => {
        schemaPromise = undefined;
        throw stageError(error, 'schema');
      });
    }
    await schemaPromise;
  }

  async function save(lead, serverReceivedAt, accessToken) {
    const ydb = sdk || require('ydb-sdk');
    const activeDriver = await getDriver(accessToken);
    await ensureSchema(activeDriver);
    const record = storageRecord(lead, serverReceivedAt);
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

  return { databaseConfigured, save };
}

module.exports = {
  CONSENT_COLUMNS,
  CONSENT_TABLE,
  LEADS_COLUMNS,
  LEADS_TABLE,
  UPSERT_LEAD,
  addUtcYears,
  createYdbStore,
  ensureTable,
  errorStatus,
  storageRecord,
  tableDescription,
  stageError,
};

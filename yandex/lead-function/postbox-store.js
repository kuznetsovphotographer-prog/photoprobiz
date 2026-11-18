'use strict';

const OUTBOX_TABLE = 'notification_outbox';
const OUTBOX_COLUMNS = [['submission_id', 'UTF8'], ['site_host', 'UTF8'], ['fingerprint', 'UTF8'],
  ['state', 'UTF8'], ['server_received_at', 'TIMESTAMP'], ['expires_at', 'TIMESTAMP'], ['message_id', 'UTF8']];
const READY_STATES = ['postbox-pending', 'postbox-retry-1', 'postbox-retry-2'];

function attachPostboxStore({ transaction, getDriver, ensureSchema, nativeRows, sdk }) {
  const ydb = () => typeof sdk === 'function' ? sdk() : sdk;
  async function preparePostbox(token) {
    await ensureSchema(await getDriver(token));
  }
  async function listPostbox(token) {
    const driver = await getDriver(token);
    await ensureSchema(driver);
    const result = await driver.tableClient.withSessionRetry(session => session.executeQuery(
      `SELECT submission_id FROM notification_outbox
       WHERE state IN ("postbox-pending", "postbox-retry-1", "postbox-retry-2")
       AND expires_at > CurrentUtcTimestamp()
       ORDER BY server_received_at, submission_id LIMIT 5;`), 10000);
    return nativeRows(ydb(), result).map(row => row.submission_id);
  }
  async function claimPostbox(id, token) {
    return transaction(token, async (session, tx) => {
      const params = { $id: ydb().TypedValues.utf8(id) };
      const result = await session.executeQuery(`DECLARE $id AS Utf8;
        SELECT state, site_host, server_received_at, expires_at FROM notification_outbox
        WHERE submission_id = $id;`, params, tx);
      const row = nativeRows(ydb(), result)[0];
      const attempt = READY_STATES.indexOf(row?.state) + 1;
      if (!attempt || new Date(row.expires_at).getTime() <= Date.now()) return null;
      // Claim is committed before any network request. No automatic lease expiry/reclaim.
      const claimState = `postbox-sending-${attempt}`;
      await session.executeQuery(`DECLARE $id AS Utf8; DECLARE $state AS Utf8;
        UPDATE notification_outbox SET state = $state WHERE submission_id = $id;`,
      { ...params, $state: ydb().TypedValues.utf8(claimState) }, tx);
      return { submissionId: id, siteHost: row.site_host, serverReceivedAt: row.server_received_at, attempt, claimState };
    });
  }
  async function finishPostbox(job, { outcome, messageId = '' }, token) {
    if (!['sent', 'failed', 'uncertain', 'retry'].includes(outcome)) throw new Error('Invalid Postbox outcome');
    const state = outcome === 'retry' ? READY_STATES[job.attempt] || 'postbox-failed' : `postbox-${outcome}`;
    const driver = await getDriver(token);
    await ensureSchema(driver);
    await driver.tableClient.withSessionRetry(session => session.executeQuery(`
      DECLARE $id AS Utf8; DECLARE $state AS Utf8; DECLARE $claim AS Utf8; DECLARE $message AS Utf8;
      UPDATE notification_outbox SET state = $state, message_id = $message
      WHERE submission_id = $id AND state = $claim;`, {
      $id: ydb().TypedValues.utf8(job.submissionId), $state: ydb().TypedValues.utf8(state),
      $claim: ydb().TypedValues.utf8(job.claimState), $message: ydb().TypedValues.utf8(messageId),
    }), 10000);
  }
  return { preparePostbox, listPostbox, claimPostbox, finishPostbox };
}
module.exports = { OUTBOX_TABLE, OUTBOX_COLUMNS, READY_STATES, attachPostboxStore };

'use strict';

const { createYdbStore } = require('./storage.js');
const POSTBOX_URL = 'https://postbox.cloud.yandex.net/v2/email/outbound-emails';
const CRM_URL = 'https://functions.yandexcloud.net/d4e5ur2fo156lrcve6id';
const SITES = new Set(['photoprobiz.ru', 'aleksreport.ru']);
const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const PRE_SEND_ERRORS = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT']);
const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short', timeStyle: 'medium', timeZone: 'Europe/Moscow',
});
function mailConfig(env) {
  const from = env.POSTBOX_FROM_EMAIL?.trim(), to = env.POSTBOX_TO_EMAIL?.trim();
  return EMAIL.test(from || '') && EMAIL.test(to || '') ? { from, to } : null;
}
const escapeHtml = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function buildMail({ submissionId, siteHost, serverReceivedAt }, { from, to }) {
  if (!SITES.has(siteHost) || !/^[A-Za-z0-9-]{16,80}$/.test(submissionId)
    || !Number.isFinite(new Date(serverReceivedAt).getTime())) throw new Error('Invalid notification metadata');
  const url = new URL(CRM_URL);
  url.searchParams.set('admin', '1'); url.searchParams.set('lead', submissionId);
  const time = `${timeFormat.format(new Date(serverReceivedAt))} (МСК)`;
  const href = escapeHtml(url.href);
  const content = Data => ({ Data, Charset: 'UTF-8' });
  return { FromEmailAddress: from, Destination: { ToAddresses: [to] }, Content: { Simple: {
    Subject: content(`Новая заявка с сайта ${siteHost}`),
    Headers: [{ Name: 'X-Submission-Id', Value: submissionId }, { Name: 'X-Source-Site', Value: siteHost }],
    Body: {
      Text: content(`Сайт: ${siteHost}\nID заявки: ${submissionId}\nПолучена сервером: ${time}\n\nОткрыть заявку: ${url.href}`),
      Html: content(`<!doctype html><html lang="ru"><body style="font-family:Arial,sans-serif;color:#222">
        <p>Сайт: ${siteHost}<br>ID заявки: ${submissionId}<br>Получена сервером: ${time}</p>
        <p><a href="${href}" style="display:inline-block;padding:12px 18px;background:#222;color:#fff;text-decoration:none">Открыть заявку</a></p>
        <p><a href="${href}">${href}</a></p></body></html>`),
    },
  } } };
}
async function sendMail(mail, token, fetchImpl) {
  try {
    const response = await fetchImpl(POSTBOX_URL, { method: 'POST', redirect: 'error',
      signal: AbortSignal.timeout(4000), headers: { 'Content-Type': 'application/json', 'X-YaCloud-SubjectToken': token },
      body: JSON.stringify(mail) });
    if (response.status === 200) {
      // Accepted is not Delivery. Retain the provider ID for later reconciliation.
      let body;
      try { body = await response.json(); } catch { return { outcome: 'uncertain' }; }
      const messageId = typeof body?.MessageId === 'string' && /^[A-Za-z0-9._@:-]{1,256}$/.test(body.MessageId) ? body.MessageId : '';
      return { outcome: messageId ? 'sent' : 'uncertain', messageId };
    }
    if (response.status === 429) return { outcome: 'retry' };
    return { outcome: response.status >= 400 && response.status < 500 && response.status !== 408 ? 'failed' : 'uncertain' };
  } catch (error) {
    return { outcome: PRE_SEND_ERRORS.has(error?.cause?.code) ? 'retry' : 'uncertain' };
  }
}
function createDrainHandler({ env = process.env, store = createYdbStore({ env }), fetchImpl = globalThis.fetch } = {}) {
  return async (event, context = {}) => {
    if (env.DELIVERY_MODE !== 'postbox') return { attempted: 0, disabled: true };
    const config = mailConfig(env), token = context.token?.access_token;
    if (!config || !token) throw new Error('POSTBOX_CONFIGURATION_MISSING');
    // Private commissioning call only. Creates missing schema without reading/sending queued jobs.
    if (event?.prepare === true) {
      await store.preparePostbox(token);
      return { prepared: true, attempted: 0 };
    }
    const candidates = await store.listPostbox(token);
    let attempted = 0;
    for (const id of candidates) {
      if (context.getRemainingTimeInMillis?.() < 25000) break;
      const job = await store.claimPostbox(id, token);
      if (!job) continue;
      let mail;
      try { mail = buildMail(job, config); }
      catch { await store.finishPostbox(job, { outcome: 'failed' }, token); continue; }
      const result = await sendMail(mail, token, fetchImpl);
      // If this write fails, the durable sending state prevents duplicate mail.
      await store.finishPostbox(job, result, token);
      attempted++;
    }
    return { attempted };
  };
}
module.exports = { POSTBOX_URL, CRM_URL, buildMail, mailConfig, sendMail, createDrainHandler, drain: createDrainHandler() };

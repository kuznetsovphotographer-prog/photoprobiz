const allowedOrigins = new Set([
  'https://kuznetsovphotographer-prog.github.io',
  'https://photoprobiz.ru',
  'https://www.photoprobiz.ru',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://localhost:5173',
]);

const responseHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

interface Env {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  RELAY_TOKEN?: string;
  ADMIN_BASE_URL?: string;
}

function corsHeaders(request: Request): Record<string, string> | null {
  const origin = request.headers.get('Origin');
  if (!origin || !allowedOrigins.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(body: Record<string, unknown>, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...responseHeaders, ...extraHeaders },
  });
}

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function parseNotification(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const notification = payload as Record<string, unknown>;
  const allowedKeys = new Set(['event', 'site', 'submissionId', 'serverReceivedAt']);
  if (Object.keys(notification).some((key) => !allowedKeys.has(key))) return null;
  const event = text(notification.event, 32);
  const site = text(notification.site, 64);
  const submissionId = text(notification.submissionId, 80);
  const serverReceivedAt = text(notification.serverReceivedAt, 40);
  if (event !== 'new_lead' || site !== 'photoprobiz.ru') return null;
  if (!/^[A-Za-z0-9-]{16,80}$/.test(submissionId)) return null;
  if (!Number.isFinite(Date.parse(serverReceivedAt))) return null;
  return { event, site, submissionId, serverReceivedAt };
}

function parseMonitorNotification(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const notification = payload as Record<string, unknown>;
  const allowedKeys = new Set(['event', 'site', 'kind', 'message']);
  if (Object.keys(notification).some((key) => !allowedKeys.has(key))) return null;
  const event = text(notification.event, 32);
  const site = text(notification.site, 64);
  const kind = text(notification.kind, 16);
  const message = text(notification.message, 3000);
  if (event !== 'site_monitor' || site !== 'photoprobiz.ru') return null;
  if (!new Set(['alert', 'recovery', 'daily']).has(kind) || !message) return null;
  return { event, site, kind, message };
}

function notificationMessage(notification: NonNullable<ReturnType<typeof parseNotification>>) {
  return [
    'Новая заявка с сайта photoprobiz',
    '',
    `ID заявки: ${notification.submissionId}`,
    `Получено сервером: ${new Date(notification.serverReceivedAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`,
    'Имя и телефон сохранены в YDB.',
  ].join('\n');
}

function sameSecret(actual: string | null, expected: string | undefined) {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function adminLeadUrl(env: Env, submissionId: string) {
  if (!env.ADMIN_BASE_URL) return null;
  try {
    const url = new URL(env.ADMIN_BASE_URL);
    if (url.protocol !== 'https:' || url.hostname !== 'functions.yandexcloud.net') return null;
    url.searchParams.set('admin', '1');
    url.searchParams.set('lead', submissionId);
    return url.toString();
  } catch { return null; }
}

async function sendTelegramMessage(env: Env, message: string, buttonUrl: string | null) {
  const body: Record<string, unknown> = { chat_id: env.TELEGRAM_CHAT_ID, text: message };
  if (buttonUrl) {
    body.reply_markup = { inline_keyboard: [[{ text: 'Открыть заявку', url: buttonUrl }]] };
  }
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error('Telegram request failed.', { status: response.status });
    throw new Error('Telegram request failed.');
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({
        ok: true,
        service: 'photoprobiz-lead-form',
        telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
        relayConfigured: Boolean(env.RELAY_TOKEN),
        adminLinkConfigured: Boolean(env.ADMIN_BASE_URL),
      });
    }

    const cors = corsHeaders(request);
    if (!cors) return json({ error: 'Origin is not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST' || !new Set(['/lead', '/monitor']).has(url.pathname)) {
      return json({ error: 'Not found.' }, 404, cors);
    }

    if (!request.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
      return json({ error: 'Content-Type must be application/json.' }, 415, cors);
    }
    let payload: unknown;
    try { payload = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400, cors); }
    if (!sameSecret(request.headers.get('X-Relay-Token'), env.RELAY_TOKEN)) {
      return json({ error: 'Unauthorized.' }, 401, cors);
    }
    if (url.pathname === '/monitor') {
      const notification = parseMonitorNotification(payload);
      if (!notification) return json({ error: 'Invalid monitor notification data.' }, 400, cors);
      if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
        return json({ error: 'Telegram delivery is not configured yet.', code: 'TELEGRAM_NOT_CONFIGURED' }, 503, cors);
      }
      try {
        await sendTelegramMessage(env, notification.message, null);
        return json({ ok: true }, 200, cors);
      } catch {
        return json({ error: 'Could not deliver the monitor notification.' }, 502, cors);
      }
    }
    const notification = parseNotification(payload);
    if (!notification) return json({ error: 'Invalid notification data.' }, 400, cors);

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      return json({
        error: 'Telegram delivery is not configured yet.',
        code: 'TELEGRAM_NOT_CONFIGURED',
      }, 503, cors);
    }

    try {
      await sendTelegramMessage(env, notificationMessage(notification), adminLeadUrl(env, notification.submissionId));
      return json({ ok: true }, 200, cors);
    } catch {
      return json({ error: 'Could not deliver the lead.' }, 502, cors);
    }
  },
} satisfies ExportedHandler<Env>;

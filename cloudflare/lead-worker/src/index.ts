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
}

const contactMethods = new Set(['phone', 'telegram', 'whatsapp', 'max_messenger']);
const packages = new Set(['Минимальный', 'Базовый', 'Полный']);
const sources = new Set(['modal', 'inline']);

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

function parseLead(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const lead = payload as Record<string, unknown>;
  const name = text(lead.name, 100);
  const contact = text(lead.contact, 160);
  const contactMethod = text(lead.contactMethod, 32);
  const packageName = text(lead.packageName, 32);
  const source = text(lead.source, 16);
  const phoneCountry = text(lead.phoneCountry, 8);
  if (!name || !contact || !contactMethods.has(contactMethod) || lead.consent !== true || !sources.has(source)) return null;
  if (packageName && !packages.has(packageName)) return null;
  return { name, contact, contactMethod, packageName, source, phoneCountry };
}

function leadMessage(lead: NonNullable<ReturnType<typeof parseLead>>) {
  const methodLabels: Record<string, string> = {
    phone: 'Телефон', telegram: 'Telegram', whatsapp: 'WhatsApp', max_messenger: 'Max',
  };
  const sourceLabels: Record<string, string> = { modal: 'Всплывающая форма', inline: 'Форма на странице' };
  return [
    'Новая заявка с сайта photoprobiz',
    '',
    `Имя: ${lead.name}`,
    `Контакт: ${lead.contact}`,
    `Способ связи: ${methodLabels[lead.contactMethod]}`,
    ...(lead.packageName ? [`Пакет: ${lead.packageName}`] : []),
    ...(lead.phoneCountry ? [`Страна номера: ${lead.phoneCountry}`] : []),
    `Форма: ${sourceLabels[lead.source]}`,
    `Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`,
  ].join('\n');
}

async function sendTelegramMessage(env: Env, message: string) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message }),
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
      });
    }

    const cors = corsHeaders(request);
    if (!cors) return json({ error: 'Origin is not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST' || url.pathname !== '/lead') {
      return json({ error: 'Not found.' }, 404, cors);
    }

    if (!request.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
      return json({ error: 'Content-Type must be application/json.' }, 415, cors);
    }

    let payload: unknown;
    try { payload = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400, cors); }
    const lead = parseLead(payload);
    if (!lead) return json({ error: 'Invalid lead data.' }, 400, cors);

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      return json({
        error: 'Telegram delivery is not configured yet.',
        code: 'TELEGRAM_NOT_CONFIGURED',
      }, 503, cors);
    }

    try {
      await sendTelegramMessage(env, leadMessage(lead));
      return json({ ok: true }, 200, cors);
    } catch {
      return json({ error: 'Could not deliver the lead.' }, 502, cors);
    }
  },
} satisfies ExportedHandler<Env>;

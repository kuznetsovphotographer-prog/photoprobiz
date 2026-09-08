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

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({
        ok: true,
        service: 'photoprobiz-lead-form',
        telegramConfigured: false,
      });
    }

    const cors = corsHeaders(request);
    if (!cors) return json({ error: 'Origin is not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST' || (url.pathname !== '/lead' && url.pathname !== '/')) {
      return json({ error: 'Not found.' }, 404, cors);
    }

    return json({
      error: 'Telegram delivery is not configured yet.',
      code: 'TELEGRAM_NOT_CONFIGURED',
    }, 503, cors);
  },
} satisfies ExportedHandler<Env>;

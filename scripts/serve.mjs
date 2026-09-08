import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import { createHash } from 'node:crypto';

// Static local preview only. Forms use the frontend mock adapter.
const root = resolve('dist');
const flag = process.argv.indexOf('--port');
const port = Number(flag < 0 ? 4173 : process.argv[flag + 1]);
const hostFlag = process.argv.indexOf('--host');
const host = hostFlag < 0 ? '127.0.0.1' : process.argv[hostFlag + 1];
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.webp':'image/webp', '.jpg':'image/jpeg', '.png':'image/png', '.woff2':'font/woff2', '.pdf':'application/pdf', '.txt':'text/plain; charset=utf-8', '.md':'text/markdown; charset=utf-8', '.xml':'application/xml; charset=utf-8' };
const cache = new Map();
mime['.avif'] = 'image/avif';

createServer(async (request, response) => {
  try {
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405, {Allow:'GET, HEAD'}); response.end(); return; }
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    let file = resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
    let status = 200;
    let info;
    try { info = await stat(file); } catch { file = resolve(root, '404.html'); status = 404; info = await stat(file); }
    if (info.isDirectory()) {
      if (!pathname.endsWith('/')) { response.writeHead(308, {Location:pathname+'/' + url.search}); response.end(); return; }
      file = resolve(file, 'index.html'); info = await stat(file);
    }
    let entry = cache.get(file);
    if (!entry || entry.mtime !== info.mtimeMs) {
      const raw = await readFile(file);
      const compress = /\.(html|css|js|json|svg|txt|md|xml)$/.test(file);
      entry = { mtime:info.mtimeMs, raw, etag:'"'+createHash('sha256').update(raw).digest('hex').slice(0,24)+'"',
        br:compress ? brotliCompressSync(raw,{params:{[constants.BROTLI_PARAM_QUALITY]:5}}) : null,
        gzip:compress ? gzipSync(raw,{level:6}) : null };
      cache.set(file, entry);
    }
    const accepted = request.headers['accept-encoding'] || '';
    const encoding = entry.br && /\bbr\b/.test(accepted) ? 'br' : entry.gzip && /\bgzip\b/.test(accepted) ? 'gzip' : null;
    const body = encoding ? entry[encoding] : entry.raw;
    const immutable = file.includes(sep+'assets'+sep) || /-[a-f\d]{9}(?:-\d+)?\.(?:webp|avif|svg)$/.test(file);
    const headers = { 'Content-Type':mime[extname(file)] || 'application/octet-stream', 'Content-Length':body.length,
      'Cache-Control':immutable ? 'public, max-age=31536000, immutable' : 'no-cache', ETag:entry.etag, Vary:'Accept-Encoding', 'X-Content-Type-Options':'nosniff' };
    if (encoding) headers['Content-Encoding'] = encoding;
    if (request.headers['if-none-match'] === entry.etag) { response.writeHead(304, headers); response.end(); return; }
    response.writeHead(status, headers); response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); response.end('Страница не найдена. Сначала выполните npm run build.');
  }
}).listen(port, host, () => console.log(`Local: http://${host}:${port}/`));

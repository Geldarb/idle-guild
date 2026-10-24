// Tiny static file server for Render. No dependencies.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
// Banner Road lives at /, the original Lantern Hall (v1) at /classic/.
const PUBLIC = /^\/(classic\/)?(index\.html|style\.css|sw\.js|manifest\.webmanifest|js\/[\w-]+\.js|icons\/[\w-]+\.(png|svg))$/;
const FRESH = /^\/(classic\/)?(index\.html|sw\.js|manifest\.webmanifest)$/;

http.createServer((req, res) => {
  // Never trust the raw URL: odd paths like "//" or bad %-escapes must not crash the server.
  let p;
  try { p = decodeURIComponent((req.url || '/').split('?')[0].replace(/\/{2,}/g, '/')); }
  catch { res.writeHead(400, { 'content-type': 'text/plain' }); return res.end('Bad request'); }
  if (p === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (p === '/classic') { res.writeHead(301, { location: '/classic/' }); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  if (!PUBLIC.test(p)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
  fs.readFile(path.join(ROOT, p), (err, body) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    // HTML and the service worker must always revalidate so updates reach players.
    const fresh = FRESH.test(p);
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream',
      'cache-control': fresh ? 'no-cache' : 'public, max-age=3600', 'x-content-type-options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
}).on('clientError', (e, sock) => sock.destroy()).listen(PORT, '0.0.0.0', () => console.log(`Banner Road (+ /classic/) on :${PORT}`));

// Tiny static file server for Render. No dependencies.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const PUBLIC = /^\/(index\.html|style\.css|sw\.js|manifest\.webmanifest|js\/[\w-]+\.js|icons\/[\w-]+\.(png|svg))$/;

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (p === '/') p = '/index.html';
  if (!PUBLIC.test(p)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
  fs.readFile(path.join(ROOT, p), (err, body) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    // HTML and the service worker must always revalidate so updates reach players.
    const fresh = p === '/index.html' || p === '/sw.js' || p === '/manifest.webmanifest';
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream',
      'cache-control': fresh ? 'no-cache' : 'public, max-age=3600', 'x-content-type-options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
}).listen(PORT, '0.0.0.0', () => console.log(`Lantern Hall on :${PORT}`));

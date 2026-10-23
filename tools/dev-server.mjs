// Local development server: serves the site and runs the /api functions the way Vercel does.
//   node tools/dev-server.mjs   (set SUPABASE_URL etc. first, or run tools/dev.mjs for a self-contained demo)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon' };

async function runFunction(file, req, res, query) {
  const mod = await import(pathToFileURL(file).href + (global.__devVersion ? '?v=' + global.__devVersion : ''));
  let raw = ''; for await (const c of req) raw += c;
  const ct = String(req.headers['content-type'] || '');
  let body = raw; if (/json/.test(ct)) { try { body = JSON.parse(raw); } catch (e) { body = {}; } }
  req.body = body; req.query = query;
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
  res.send = (s) => { res.end(s); return res; };
  await mod.default(req, res);
}

export function startDevServer({ port = 0 } = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const q = Object.fromEntries(url.searchParams);
      if (url.pathname.startsWith('/api/')) {
        const parts = url.pathname.replace(/^\/api\//, '').split('/');
        if (parts[0] === 'admin' && parts[1]) return await runFunction(path.join(ROOT, 'api/admin/[action].js'), req, res, { ...q, action: parts[1] });
        const f = path.join(ROOT, 'api', parts[0] + '.js');
        if (/^[a-z-]+$/.test(parts[0]) && fs.existsSync(f)) return await runFunction(f, req, res, q);
        res.statusCode = 404; return res.end('Not found');
      }
      let p = decodeURIComponent(url.pathname);
      if (p === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || /\/(api|tests|tools|supabase|docs)\//.test(p) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('Not found'); }
      res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    } catch (e) { console.error(e); res.statusCode = 500; res.end('error'); }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ port: server.address().port, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) })));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startDevServer({ port: +process.env.PORT || 3000 }).then((s) => console.log('Dev server on', s.url));
}

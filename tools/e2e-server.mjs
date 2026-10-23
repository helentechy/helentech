// Self-contained local environment for demos and browser tests: the site + API + a stand-in Supabase + a stubbed email provider.
// NOT for production. Usage: node tools/e2e-server.mjs   -> prints the URL and demo logins.
import { startMockSupabase } from './mock-supabase.mjs';
import { startDevServer } from './dev-server.mjs';
const mock = await startMockSupabase({ port: +process.env.MOCK_PORT || 0, users: [{ email: 'owner@helentech.test', password: 'Owner-Pass-123' }, { email: 'viewer@helentech.test', password: 'Viewer-Pass-123' }] });
mock.addAdmin('owner@helentech.test', 'owner'); mock.addAdmin('viewer@helentech.test', 'viewer');
Object.assign(process.env, { SUPABASE_URL: mock.url, SUPABASE_ANON_KEY: mock.anonKey, SUPABASE_SERVICE_ROLE_KEY: mock.serviceKey, RESEND_API_KEY: 're_local_stub' });
const real = globalThis.fetch; const emails = [];
globalThis.fetch = async (url, opts) => { if (String(url).startsWith('https://api.resend.com')) { emails.push(JSON.parse(opts.body)); return { ok: true, status: 200, json: async () => ({ id: 'stub' }) }; } return real(url, opts); };
const app = await startDevServer({ port: +process.env.PORT || 8766 });
console.log(JSON.stringify({ site: app.url, mock: mock.url, owner: 'owner@helentech.test / Owner-Pass-123', viewer: 'viewer@helentech.test / Viewer-Pass-123' }));
// tiny inspection endpoint for tests (emails the stub "sent")
import http from 'node:http';
http.createServer((q, r) => { r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify({ emails })); }).listen(+process.env.INSPECT_PORT || 8767, '127.0.0.1');

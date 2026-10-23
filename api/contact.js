// /api/contact.js
// Serverless function (Vercel Node.js) behind every HelenTech enquiry form (the pop-up and the
// forms on the Contact and FAQ pages). It validates the enquiry, blocks spam and duplicates, and
// emails it to you through Resend. API keys live ONLY in environment variables, never in the site.
//
// Environment variables (Vercel > Project > Settings > Environment Variables):
//   RESEND_API_KEY           REQUIRED. Your Resend API key.
//   CONTACT_TO_EMAIL         Where enquiries are sent. Default: helentech776@gmail.com
//   CONTACT_FROM_EMAIL       Sender, e.g. "HelenTech <enquiries@yourdomain.com>". Needs a domain verified
//                            in Resend. Without it the sandbox sender is used, which can only deliver to
//                            the email address your Resend account was created with, and the customer
//                            acknowledgement email is switched off.
//   SEND_ACK_EMAIL           "true"/"false". Customer acknowledgement email. Default: on only when
//                            CONTACT_FROM_EMAIL is set.
//   ACK_RESPONSE_TIME        Optional sentence for the acknowledgement, e.g. "We aim to reply within 1 business
//                            day." Leave unset to promise no response time.
//   LEAD_BACKUP_WEBHOOK_URL  Optional. If the email cannot be sent, the enquiry is POSTed here (Zapier, Make,
//                            Slack, Google Sheets webhook...) so it is never lost.
//   CONTACT_TIMEZONE         Time zone used in the email. Default: Africa/Lagos

import { recordConversion } from './_lib/conversions.js';

const MAX = { name: 120, email: 200, phone: 40, company: 160, website: 300, service: 120, enquiryType: 60, budget: 60, contactMethod: 30, details: 5000, page: 200, botcheck: 200, sid: 64, vid: 64, formSource: 20 };

const SERVICES = [
  // pop-up form
  'Google Business Profile Optimization', 'Google Merchant Center Setup & Suspension Fixes', 'Google Ads & Analytics', 'Other Services',
  // contact page form
  'Google Business Profile', 'Google Merchant Center', 'Google Ads', 'Google Analytics 4', 'Other',
];
const ENQUIRY_TYPES = ['Request a Quote', 'Ask a Question', 'Request a Website Audit', 'Discuss a Project', 'General Enquiry'];

const WINDOW_MS = 15 * 60 * 1000;   // rate-limit window
const MAX_PER_WINDOW = 5;           // enquiries per IP per window
const DUP_WINDOW_MS = 10 * 60 * 1000;
const MIN_FILL_MS = 1500;           // humans need more than this to fill the form

// In-memory, per server instance. Good protection against simple floods; for stronger limits use Vercel WAF / Upstash.
const hits = new Map();
const recent = new Map();
export function __resetForTests() { hits.clear(); recent.clear(); }

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const oneLine = (v) => String(v).replace(/[\r\n]+/g, ' ').trim();
const clean = (v) => String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  return (typeof xf === 'string' && xf.split(',')[0].trim()) || (req.socket && req.socket.remoteAddress) || 'unknown';
}
function rateLimited(ip, now) {
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}
async function fingerprint(f) {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update([f.email.toLowerCase(), f.details.toLowerCase(), f.enquiryType].join('|')).digest('hex');
}
function when(tz) {
  const d = new Date();
  let local;
  try { local = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: tz }).format(d); } catch (e) { local = ''; tz = 'UTC'; }
  return { local: local ? `${local} (${tz})` : '', iso: d.toISOString() };
}
async function postJson(url, payload, timeoutMs) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs || 6000);
  try { return await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctl.signal }); }
  finally { clearTimeout(t); }
}

export default async function handler(req, res) {
  // Owner check: open  /api/contact?health=1  in a browser to see whether email sending is set up. Never shows secrets.
  if (req.method === 'GET' && (req.query && req.query.health !== undefined)) {
    res.setHeader('Cache-Control', 'no-store');
    const keySet = !!process.env.RESEND_API_KEY, custom = !!process.env.CONTACT_FROM_EMAIL;
    const problems = [];
    if (!keySet) problems.push('RESEND_API_KEY is not set in Vercel Environment Variables (then redeploy).');
    if (keySet && !custom) problems.push('Using the Resend sandbox sender: it can only deliver to the email address your Resend account was created with. Log in to Resend with ' + (process.env.CONTACT_TO_EMAIL || 'helentech776@gmail.com') + ', or verify a domain and set CONTACT_FROM_EMAIL.');
    return res.status(200).json({
      ready: keySet, emailKeySet: keySet, sender: custom ? 'custom domain' : 'resend sandbox', sendsTo: process.env.CONTACT_TO_EMAIL || 'helentech776@gmail.com',
      customerAcknowledgement: (process.env.SEND_ACK_EMAIL ? process.env.SEND_ACK_EMAIL.toLowerCase() === 'true' : custom), backupWebhookSet: !!process.env.LEAD_BACKUP_WEBHOOK_URL,
      analyticsDatabaseSet: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY), problems,
    });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body && typeof body === 'object' ? body : {};

  const f = {};
  for (const k of Object.keys(MAX)) f[k] = typeof body[k] === 'string' ? clean(body[k]).trim().slice(0, MAX[k]) : '';
  if (!f.details && typeof body.message === 'string') f.details = clean(body.message).trim().slice(0, MAX.details);
  if (!f.company && typeof body.business === 'string') f.company = clean(body.business).trim().slice(0, MAX.company);
  if (!ENQUIRY_TYPES.includes(f.enquiryType)) f.enquiryType = 'General Enquiry';

  // Spam: honeypot, and forms submitted impossibly fast. Pretend success so bots learn nothing.
  const fillMs = Number(body.fillMs);
  if (f.botcheck || (Number.isFinite(fillMs) && fillMs >= 0 && fillMs < MIN_FILL_MS)) {
    return res.status(200).json({ success: true });
  }

  // Validation
  const errors = [];
  if (f.name.length < 2) errors.push('Please enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) errors.push('Please enter a valid email address.');
  if (f.phone) {
    const digits = f.phone.replace(/\D/g, '');
    if (!/^[+\d][\d\s().-]{5,}$/.test(f.phone) || digits.length < 7 || digits.length > 15) errors.push('Please enter a valid phone or WhatsApp number, or leave it empty.');
  }
  if (f.service && !SERVICES.includes(f.service)) f.service = 'Other Services';
  if (f.details.length < 10) errors.push('Please write a short message so we know how to help.');
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const now = Date.now();
  if (rateLimited(clientIp(req), now)) {
    return res.status(429).json({ error: 'You have sent several enquiries in a short time. Please wait a few minutes and try again, or message us on WhatsApp.' });
  }

  // Duplicate protection (same person, same message, same type)
  const fp = await fingerprint(f);
  for (const [k, t] of recent) if (now - t > DUP_WINDOW_MS) recent.delete(k);
  if (recent.has(fp)) return res.status(200).json({ success: true, duplicate: true });

  const ownerEmail = process.env.CONTACT_TO_EMAIL || 'helentech776@gmail.com';
  const stamp = when(process.env.CONTACT_TIMEZONE || 'Africa/Lagos');
  const lead = {
    receivedAt: stamp.iso, name: f.name, email: f.email, phone: f.phone || '', business: f.company || '', website: f.website || '',
    service: f.service || '', enquiryType: f.enquiryType, budget: f.budget || '', preferredContact: f.contactMethod || '', message: f.details, page: f.page || '',
  };

  const markConverted = () => recordConversion({ sid: f.sid, vid: f.vid, path: f.page, service: f.service, enquiryType: f.enquiryType, formSource: f.formSource });

  // Never lose an enquiry: if email fails, log the full enquiry and (optionally) send it to a backup webhook
  async function saveBackup(reason) {
    console.error('LEAD_NOT_DELIVERED', JSON.stringify({ reason, lead }));
    const url = process.env.LEAD_BACKUP_WEBHOOK_URL;
    if (!url) return false;
    try { const r = await postJson(url, { type: 'helentech_enquiry_backup', reason, lead }, 6000); return r.ok; }
    catch (e) { console.error('Backup webhook failed:', e && e.message); return false; }
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    const saved = await saveBackup('RESEND_API_KEY missing');
    if (saved) { recent.set(fp, now); await markConverted(); return res.status(200).json({ success: true }); }
    return res.status(500).json({ error: 'The enquiry form is not fully set up yet. Please email or message us on WhatsApp instead.', fallback: true });
  }

  const rows = [
    ['Full name', f.name], ['Email', f.email], ['Phone / WhatsApp', f.phone || 'Not provided'], ['Business name', f.company || 'Not provided'],
    ['Website', f.website || 'Not provided'], ['Service', f.service || 'Not specified'], ['Enquiry type', f.enquiryType], ['Budget', f.budget || 'Not provided'],
    ['Preferred contact', f.contactMethod || 'No preference'], ['Submitted', `${stamp.local}${stamp.local ? ' | ' : ''}${stamp.iso}`], ['Page', f.page || 'Not recorded'],
  ].filter(([l, v]) => !(['Website', 'Preferred contact', 'Page'].includes(l) && /^(Not provided|No preference|Not recorded)$/.test(v)));

  const label = 'padding:12px 0;border-bottom:1px solid #E3E7ED;font-size:12px;font-weight:600;color:#565D68;text-transform:uppercase;letter-spacing:0.04em;width:150px;vertical-align:top;';
  const val = 'padding:12px 0;border-bottom:1px solid #E3E7ED;font-size:15px;color:#14171C;vertical-align:top;';
  const rowsHtml = rows.map(([l, v]) => `<tr><td style="${label}">${esc(l)}</td><td style="${val}">${l === 'Email' ? `<a href="mailto:${esc(f.email)}" style="color:#2680BF;font-weight:bold;">${esc(v)}</a>` : esc(v)}</td></tr>`).join('');
  const replySubject = encodeURIComponent(`Re: your HelenTech enquiry (${f.enquiryType})`);
  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F6F7F9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7F9;padding:32px 16px;"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E3E7ED;">
      <tr><td style="height:6px;background:#2680BF;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:28px 36px 8px;">
        <div style="font-size:18px;font-weight:bold;color:#14171C;">Helen<span style="color:#F78616;">Tech</span></div>
        <h1 style="margin:18px 0 4px;font-size:20px;color:#14171C;">New website enquiry: ${esc(f.enquiryType)}</h1>
        <p style="margin:0;font-size:14px;color:#565D68;">Reply to this email to answer ${esc(f.name)} directly.</p>
      </td></tr>
      <tr><td style="padding:16px 36px 0;"><div style="background:#E7F2FA;border-left:4px solid #2680BF;border-radius:6px;padding:12px 16px;font-size:15px;color:#14171C;"><strong>${esc(f.name)}</strong><br><a href="mailto:${esc(f.email)}" style="color:#2680BF;font-weight:bold;">${esc(f.email)}</a></div></td></tr>
      <tr><td style="padding:12px 36px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table></td></tr>
      <tr><td style="padding:20px 36px 8px;">
        <div style="font-size:12px;font-weight:600;color:#565D68;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">Message</div>
        <div style="background:#F6F7F9;border:1px solid #E3E7ED;border-radius:8px;padding:16px 18px;font-size:15px;line-height:1.6;color:#14171C;white-space:pre-wrap;">${esc(f.details)}</div>
      </td></tr>
      <tr><td style="padding:24px 36px 32px;"><a href="mailto:${esc(f.email)}?subject=${replySubject}" style="display:inline-block;background:#F78616;color:#14171C;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:8px;">Reply to ${esc(f.name)}</a></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  const text = ['NEW HELENTECH WEBSITE ENQUIRY', '', `Reply to: ${f.name} <${f.email}>`, '', ...rows.map(([l, v]) => `${l}: ${v}`), '', 'Message:', f.details].join('\n');

  const from = process.env.CONTACT_FROM_EMAIL || 'HelenTech Website <onboarding@resend.dev>';
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const idem = oneLine(req.headers['x-idempotency-key'] || '').slice(0, 100);
  if (/^[A-Za-z0-9_-]{8,100}$/.test(idem)) headers['Idempotency-Key'] = `enquiry-${idem}`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers,
      body: JSON.stringify({ from, to: [ownerEmail], reply_to: f.email, subject: oneLine(`New HelenTech Website Enquiry \u2014 ${f.enquiryType}`), html, text }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('Resend error:', r.status, JSON.stringify(data));
      const saved = await saveBackup(`Resend ${r.status}`);
      if (saved) { recent.set(fp, now); await markConverted(); return res.status(200).json({ success: true }); }
      return res.status(502).json({ error: 'We could not send your enquiry right now.', fallback: true });
    }
  } catch (err) {
    console.error('Unexpected error sending email:', err);
    const saved = await saveBackup('Email request failed');
    if (saved) { recent.set(fp, now); await markConverted(); return res.status(200).json({ success: true }); }
    return res.status(500).json({ error: 'Something went wrong while sending your enquiry.', fallback: true });
  }
  recent.set(fp, now);
  await markConverted();   // only now is it a completed enquiry

  // Acknowledgement to the customer (best effort: never makes the enquiry fail)
  const ackSetting = (process.env.SEND_ACK_EMAIL || '').toLowerCase();
  const ackOn = ackSetting ? ackSetting === 'true' : !!process.env.CONTACT_FROM_EMAIL;
  if (ackOn) {
    try {
      const timeLine = process.env.ACK_RESPONSE_TIME ? `<p style="margin:0 0 14px;">${esc(process.env.ACK_RESPONSE_TIME)}</p>` : '';
      const ackHtml = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#14171C;line-height:1.6;">
  <div style="height:6px;background:#2680BF;"></div>
  <div style="padding:24px 4px;"><div style="font-size:18px;font-weight:bold;">Helen<span style="color:#F78616;">Tech</span></div>
  <p style="margin:18px 0 14px;">Hi ${esc(f.name.split(' ')[0])},</p>
  <p style="margin:0 0 14px;">Thank you for contacting HelenTech. We have received your enquiry (${esc(f.enquiryType)}) and will review it and reply to you by email.</p>${timeLine}
  <p style="margin:0 0 6px;font-size:13px;color:#565D68;">A copy of your message:</p>
  <div style="background:#F6F7F9;border:1px solid #E3E7ED;border-radius:8px;padding:14px 16px;font-size:14px;white-space:pre-wrap;">${esc(f.details)}</div>
  <p style="margin:18px 0 0;font-size:13px;color:#565D68;">If you did not send this enquiry, you can ignore this email.</p></div></div>`;
      const ackText = `Hi ${f.name.split(' ')[0]},\n\nThank you for contacting HelenTech. We have received your enquiry (${f.enquiryType}) and will review it and reply to you by email.\n${process.env.ACK_RESPONSE_TIME ? '\n' + process.env.ACK_RESPONSE_TIME + '\n' : ''}\nYour message:\n${f.details}\n\nIf you did not send this enquiry, you can ignore this email.`;
      const ar = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [f.email], reply_to: ownerEmail, subject: 'We received your enquiry | HelenTech', html: ackHtml, text: ackText }),
      });
      if (!ar.ok) console.error('Acknowledgement email failed:', ar.status, JSON.stringify(await ar.json().catch(() => ({}))));
    } catch (e) { console.error('Acknowledgement email error:', e && e.message); }
  }
  return res.status(200).json({ success: true });
}

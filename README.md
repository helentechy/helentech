# HelenTech website

HelenTech is a Google services specialist. The site covers four services only: Google Business Profile and Local SEO, Google Merchant Center, Google Ads, and Google Analytics 4 (GA4).

Static website (HTML, CSS, JavaScript) plus one serverless function for the contact form.
Deploy on Vercel (drag the folder into https://vercel.com/new, or connect a Git repo).

## Where things live
| What | File |
| --- | --- |
| Colours, typography, spacing, all components | `assets/css/site.css` (edit the `:root` tokens at the top) |
| Shared behaviour (menu, FAQ, filters, form, analytics) | `assets/js/site.js` |
| Site settings (GA4 ID, WhatsApp, placeholders switch) | `assets/js/config.js` |
| Portfolio projects and testimonials | `assets/js/content.js` |
| Menu and footer for every page | `tools/layout.py` (see below) |
| Contact form email | `api/contact.js` |

## Add a portfolio project
1. Save the image in `assets/img/projects/` (about 1200px wide, .webp or .jpg).
2. Copy the template block at the bottom of `assets/js/content.js`, fill it in, add it to the list.
3. It appears on the portfolio page and filters automatically (use `gmb`, `gmc` or `ads` in `sub`/`filters`). Set `featured: true` to show it on the homepage.
Only add results that are genuine.

## Add a testimonial
Add an object to `HELENTECH_TESTIMONIALS` in `assets/js/content.js` (the format is in the comments).
While the list is empty, clearly labelled example cards show. To hide them instead, set
`showTestimonialPlaceholders: false` in `assets/js/config.js`.

## Change the menu or footer on every page
Edit the templates in `tools/layout.py`, then run `python3 tools/layout.py`.
It rewrites the header and footer between the `SITE-HEADER` and `SITE-FOOTER` markers on all pages.

## Analytics dashboard (private, at /admin/)
A privacy-friendly analytics system and a private dashboard, built into this site.

**How it works**
- `assets/js/analytics.js` shows a consent banner. **Nothing is stored or sent until the visitor presses "Accept analytics"** (declining, or a Global Privacy Control / Do Not Track signal, means no tracking). Footer link "Cookie settings" lets visitors change their mind; withdrawing deletes their anonymous IDs.
- Accepted visitors send page views, active time on page and clicks on key buttons to `/api/collect` (`api/collect.js`), which stores them in **Supabase (PostgreSQL)**. No IP address, no names/emails/messages, no raw user agent is stored.
- **Enquiries (conversions)** are written only by `/api/contact` after the enquiry email is accepted, never by the browser, so clicking a button never counts as a lead.
- `/admin/` is the dashboard (sign in with a Supabase Auth account; roles `owner` = full + CSV export, `viewer` = read-only). Data is served by `api/admin/[action].js`. The session cookie is HttpOnly + SameSite=Strict.
- `/privacy.html` is the privacy and cookie notice (`python3 tools/privacy_page.py` rebuilds it).

**One-time setup**
1. Create a free project at supabase.com.
2. Supabase > SQL Editor: paste and run `supabase/migrations/001_helentech_analytics.sql`. (Optional: run `002_retention_optional.sql` to auto-delete data older than 24 months. It needs the pg_cron extension.)
3. Supabase > Authentication > Users > **Add user** (your email + a strong password, tick "Auto confirm"). Then in Authentication > Sign In / Providers, **turn off "Allow new users to sign up"**.
4. SQL Editor: `insert into public.admin_users (user_id, email, role) select id, email, 'owner' from auth.users where email = 'YOUR-EMAIL';` (use `'viewer'` for read-only people).
5. Supabase > Project Settings > API: copy the **Project URL**, the **anon public** key and the **service_role** key.
6. Vercel > Settings > Environment Variables (see `.env.example`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Redeploy.
7. Open `https://YOUR-DOMAIN/admin/`, sign in, then browse your own site, press "Accept analytics" and watch the numbers appear.

The **service_role key is a secret**: only ever put it in Vercel environment variables. It is never sent to the browser.

**Notes**
- Figures cover only visitors who accepted analytics. Enquiries are counted for everyone (those without consent show as "without source data").
- "Online now" = a signal in the last 5 minutes. Time on page = active, visible time (an estimate). Bounce = one page view and no tracked click.
- Google Analytics 4 (set `gaMeasurementId` in `assets/js/config.js`) only loads after consent and is separate from this system, so nothing is double counted inside either one.
- Try it locally with no accounts: `npm run demo` starts the site plus a stand-in database (logins are printed). Tests: `npm test`.
- Locations come from Vercel's geo headers (only available when deployed on Vercel).

## Enquiry system (forms and email)
> **The enquiry pop-up and the floating "Have a Question?" button are switched off.** The code is kept: set `ENQUIRY_POPUP_ENABLED = True` in `tools/layout.py`, set `enquiryPopupEnabled: true` in `assets/js/config.js`, then run `python3 tools/blog.py` to bring them back. The Contact and FAQ page forms use the same email setup below.

Every enquiry form on the site (the pop-up, the Contact page form and the FAQ page form) posts to
`/api/contact`, which validates it, blocks spam and duplicates, and emails it to
**helentech776@gmail.com** through Resend. The pop-up and button live in `tools/enquiry_modal.html`,
`assets/js/enquiry.js` and the "Enquiry pop-up" block at the end of `assets/css/site.css`; `tools/layout.py`
adds them to every page, so run `python3 tools/layout.py` after editing the modal HTML.

**Set these in Vercel > Project > Settings > Environment Variables, then redeploy** (see `.env.example`):

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Yes | Your Resend API key. Never put it in code or in `/assets`. |
| `CONTACT_TO_EMAIL` | No | Where enquiries are sent. Default: `helentech776@gmail.com` |
| `CONTACT_FROM_EMAIL` | Recommended | Sender, e.g. `HelenTech <enquiries@yourdomain.com>`. Needs a domain verified in Resend. |
| `SEND_ACK_EMAIL` | No | `true`/`false`. Customer acknowledgement email. Default: on only when `CONTACT_FROM_EMAIL` is set. |
| `ACK_RESPONSE_TIME` | No | A sentence about reply time for the acknowledgement. Unset = no time is promised. |
| `LEAD_BACKUP_WEBHOOK_URL` | No | If the email cannot be sent, the enquiry is posted here (Zapier, Make, Slack...) so it is never lost. |
| `CONTACT_TIMEZONE` | No | Time zone shown in the email. Default: `Africa/Lagos` |

Until a domain is verified in Resend, the sandbox sender can only deliver to the email address your Resend
account was created with. Use that address as the Resend login, or verify a domain, before going live.

**Settings in `assets/js/config.js`:** `enquiryPopupEnabled` (turn the automatic pop-up off), `enquiryPopupDelayMs`
(default 10000), `whatsappNumber` (used by the WhatsApp buttons) and `contactEmail`.

**Protection built in:** hidden honeypot field, minimum fill time, per-IP rate limit (5 per 15 minutes, per server
instance), duplicate detection, request idempotency key, input length limits and HTML/header-injection escaping.
If the email fails, the full enquiry is written to the Vercel function logs as `LEAD_NOT_DELIVERED` (and sent to the
backup webhook if you set one), and the visitor sees an error with email and WhatsApp fallbacks.
The rate limit is in memory, so for heavy traffic add Vercel WAF rate limiting or Upstash.

**Tests:** `node --test tests/contact.test.mjs` (API: validation, spam, duplicates, emails, failures).

**Security: the old version of `api/contact.js` contained a live Resend API key in the code.
That key has been exposed, so create a new key in Resend, delete the old one, and set the new
one as `RESEND_API_KEY`.**

## Analytics (Google Analytics 4)
1. In GA4 create a web data stream and copy the Measurement ID (looks like `G-ABC123XYZ9`).
2. Put it in `gaMeasurementId` in `assets/js/config.js`. Until then, no tracking runs.
Events sent: `page_view` (automatic), `contact_form_submission`, `cta_click`, `whatsapp_click`,
`pricing_view`, `portfolio_view`, `service_view`, plus `portfolio_filter` and `faq_open`.
No names, emails, phone numbers or message text are sent. To see conversions in GA4, mark
`contact_form_submission` as a key event (Admin > Events). If you serve visitors in the EU or UK,
add a cookie consent banner before enabling analytics.


## Discontinued pages
`vercel.json` permanently redirects the removed service pages (website design, Shopify, WordPress, Wix, digital marketing, email and social media) to the Google services pages, so old links and search results keep working. The removed portfolio items and testimonials are kept in `docs/archived-unverified-content.md`.

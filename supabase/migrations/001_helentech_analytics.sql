-- HelenTech analytics: tables, indexes and row level security.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste this file > Run.
-- Nothing here is readable from the browser: RLS is ON and there are NO public policies, so only the
-- server-side functions (which use the service role key) can read or write these tables.

create table if not exists public.analytics_sessions (
  id              text primary key,                -- random session id created by the tracking script
  visitor_id      text not null,                   -- random anonymous id, only set after consent
  started_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  is_new_visitor  boolean not null default false,
  entry_path      text,
  referrer_host   text,
  source          text not null default 'Direct',  -- Google (organic), Other search, Social, Referral, Paid (Google Ads), Direct
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  device          text,                            -- desktop | mobile | tablet
  browser         text,
  os              text,
  country         text,                            -- from the hosting provider's geo header; the IP is never stored
  city            text
);
create index if not exists analytics_sessions_started_idx on public.analytics_sessions (started_at);
create index if not exists analytics_sessions_last_seen_idx on public.analytics_sessions (last_seen_at);
create index if not exists analytics_sessions_visitor_idx on public.analytics_sessions (visitor_id);

create table if not exists public.analytics_pageviews (
  id            text primary key,                  -- page view id created by the tracking script (prevents duplicates)
  session_id    text not null references public.analytics_sessions(id) on delete cascade,
  visitor_id    text not null,
  path          text not null,
  title         text,
  created_at    timestamptz not null default now(),
  engaged_ms    integer not null default 0         -- visible time on the page, capped at 30 minutes
);
create index if not exists analytics_pageviews_created_idx on public.analytics_pageviews (created_at);
create index if not exists analytics_pageviews_path_idx on public.analytics_pageviews (path);
create index if not exists analytics_pageviews_session_idx on public.analytics_pageviews (session_id);

create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  text references public.analytics_sessions(id) on delete cascade,
  visitor_id  text,
  name        text not null,                       -- cta_click, whatsapp_click, email_click, call_click, portfolio_click, ...
  path        text,
  props       jsonb not null default '{}'::jsonb,  -- small, sanitised properties (button label etc). Never form contents.
  created_at  timestamptz not null default now()
);
create index if not exists analytics_events_created_idx on public.analytics_events (created_at);
create index if not exists analytics_events_name_idx on public.analytics_events (name);

-- Completed enquiries only. Written by the server after the enquiry email was accepted. Holds NO names, emails or messages.
create table if not exists public.analytics_conversions (
  id            uuid primary key default gen_random_uuid(),
  session_id    text references public.analytics_sessions(id) on delete set null,
  visitor_id    text,
  name          text not null default 'enquiry_submitted',
  path          text,                              -- page the form was submitted from
  service       text,
  enquiry_type  text,
  form_source   text,                              -- popup | contact_page | faq_page
  created_at    timestamptz not null default now()
);
create index if not exists analytics_conversions_created_idx on public.analytics_conversions (created_at);

-- Who may open the dashboard. Passwords live in Supabase Auth (auth.users), never here.
create table if not exists public.admin_users (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  role        text not null default 'viewer' check (role in ('owner', 'viewer')),   -- owner: full access + CSV export; viewer: read-only
  created_at  timestamptz not null default now()
);

alter table public.analytics_sessions     enable row level security;
alter table public.analytics_pageviews    enable row level security;
alter table public.analytics_events       enable row level security;
alter table public.analytics_conversions  enable row level security;
alter table public.admin_users            enable row level security;
-- (No policies on purpose: anon and authenticated browser users cannot read or write anything.)

-- AFTER creating your login in Supabase (Authentication > Users > Add user), make yourself the owner:
--   insert into public.admin_users (user_id, email, role)
--   select id, email, 'owner' from auth.users where email = 'helentech776@gmail.com';

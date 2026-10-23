-- OPTIONAL: automatically delete analytics older than 24 months (matches the privacy notice wording).
-- Requires the pg_cron extension (Supabase: Database > Extensions > pg_cron > enable). Run once.
select cron.schedule('helentech-analytics-retention', '0 3 * * *', $$
  delete from public.analytics_events      where created_at < now() - interval '24 months';
  delete from public.analytics_pageviews   where created_at < now() - interval '24 months';
  delete from public.analytics_conversions where created_at < now() - interval '24 months';
  delete from public.analytics_sessions    where started_at < now() - interval '24 months';
$$);

-- Japa analytics: an anonymous star schema (adapted from the design doc) for Supabase or any PostgreSQL.
-- The game writes events directly with the public "anon" key; Row Level Security allows INSERT only,
-- so nobody can read player data from the browser. No names, ages, states or free text are ever sent.

create table if not exists dim_player_profiles (
  player_id      text primary key,                 -- random id generated in the browser (japa.anon.v1)
  archetype      text,                             -- tech | health | teach | eng | trades | business | student
  initial_route  text,                             -- first route played
  created_at     timestamptz not null default now()
);

create table if not exists fact_game_analytics (
  event_id        bigserial primary key,
  player_id       text not null,
  event           text not null,                   -- app_open, signup_complete, run_start, run_end, share, crisis, ...
  route           text,                            -- NIGERIA_LIFE, STUDY_PERMIT, SPLIT_FAMILY, ...
  current_phase   smallint,                        -- 1 Nigeria, 2 Canada (derived from the route/scene)
  node            text,                            -- scene id when the event fired
  metric_stress   smallint,                        -- Village People / desperation 0..100
  metric_family_strain smallint,                   -- Split Family route only
  props           jsonb not null default '{}',     -- ending, result, moves, source, channel, ...
  logged_at       timestamptz not null default now()
);

create index if not exists idx_fact_event on fact_game_analytics (event);
create index if not exists idx_fact_route on fact_game_analytics (route);
create index if not exists idx_fact_logged on fact_game_analytics (logged_at);

alter table dim_player_profiles enable row level security;
alter table fact_game_analytics enable row level security;
create policy "anon can insert events" on fact_game_analytics for insert to anon with check (true);
create policy "anon can insert profiles" on dim_player_profiles for insert to anon with check (true);
-- No select/update/delete policies for anon: reads happen in the Supabase dashboard or with the service key.

-- Useful views for the investor deck -------------------------------------------------------------------
create or replace view v_route_funnel as
select route,
       count(*) filter (where event = 'run_start')                         as starts,
       count(*) filter (where event = 'run_end')                           as finishes,
       count(*) filter (where event = 'run_end' and props->>'result' = 'win') as wins,
       round(100.0 * count(*) filter (where event = 'run_end') / nullif(count(*) filter (where event = 'run_start'), 0), 1) as completion_pct
from fact_game_analytics group by route;

create or replace view v_village_people_hotspots as   -- where players fall
select route, props->>'ending' as ending, count(*) as runs
from fact_game_analytics where event = 'run_end' and props->>'result' = 'fail'
group by 1, 2 order by runs desc;

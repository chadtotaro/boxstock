-- ============================================================
-- Boxstock Timing System — Supabase Migration
-- ============================================================

-- Race session
create table if not exists races (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid references auth.users(id),
  status        text not null default 'setup'
                  check (status in ('setup', 'active', 'complete', 'practice')),
  mode          text not null default 'race'
                  check (mode in ('race', 'practice')),
  duration_ms   integer,                          -- null for practice mode
  track_id      uuid,                             -- optional link to a saved layout
  title         text,                             -- e.g. "Friday Night Race 3"
  created_at    timestamptz not null default now(),
  started_at    timestamptz,                      -- set when race goes ACTIVE
  ended_at      timestamptz,                      -- set when race goes COMPLETE
  synced_at     timestamptz                       -- last sync from client IndexedDB
);

-- Participants in a race
create table if not exists race_participants (
  id              uuid primary key default gen_random_uuid(),
  race_id         uuid not null references races(id) on delete cascade,
  user_id         uuid references auth.users(id),  -- null for guests
  display_name    text not null,
  transponder_id  integer not null,                 -- raw 2-byte value from decoder
  is_guest        boolean not null default false,
  created_at      timestamptz not null default now(),

  -- no duplicate transponders in the same race
  unique (race_id, transponder_id)
);

-- Individual lap events (source of truth)
create table if not exists race_laps (
  id              uuid primary key default gen_random_uuid(),
  race_id         uuid not null references races(id) on delete cascade,
  participant_id  uuid not null references race_participants(id) on delete cascade,
  lap_number      integer not null,                 -- 1-indexed
  lap_time_ms     integer not null,                 -- time for this lap in ms
  decoder_ts_ms   bigint not null,                  -- raw decoder timestamp (ms since power-on)
  wall_clock_at   timestamptz not null default now(),
  suppressed      boolean not null default false,   -- true if debounce filtered it
  created_at      timestamptz not null default now(),

  unique (race_id, participant_id, lap_number)
);

-- Final results (computed at race end, denormalized for fast reads)
create table if not exists race_results (
  id              uuid primary key default gen_random_uuid(),
  race_id         uuid not null references races(id) on delete cascade,
  participant_id  uuid not null references race_participants(id) on delete cascade,
  position        integer not null,
  total_laps      integer not null,
  best_lap_ms     integer,
  total_time_ms   bigint not null,
  created_at      timestamptz not null default now(),

  unique (race_id, participant_id)
);

-- Indexes for common queries
create index if not exists idx_race_laps_race on race_laps(race_id);
create index if not exists idx_race_laps_participant on race_laps(participant_id);
create index if not exists idx_race_participants_race on race_participants(race_id);
create index if not exists idx_race_results_race on race_results(race_id);
create index if not exists idx_races_created_by on races(created_by);

-- RLS policies (race data is readable by anyone, writable by creator)
alter table races enable row level security;
alter table race_participants enable row level security;
alter table race_laps enable row level security;
alter table race_results enable row level security;

-- Read: anyone can view races (public leaderboard)
create policy "Races are viewable by everyone"
  on races for select using (true);

create policy "Race participants are viewable by everyone"
  on race_participants for select using (true);

create policy "Race laps are viewable by everyone"
  on race_laps for select using (true);

create policy "Race results are viewable by everyone"
  on race_results for select using (true);

-- Write: authenticated creator or anon sync (for offline races)
create policy "Creator can manage races"
  on races for all using (auth.uid() = created_by);

create policy "Creator can manage participants"
  on race_participants for all
  using (race_id in (select id from races where created_by = auth.uid()));

create policy "Creator can manage laps"
  on race_laps for all
  using (race_id in (select id from races where created_by = auth.uid()));

create policy "Creator can manage results"
  on race_results for all
  using (race_id in (select id from races where created_by = auth.uid()));

-- Allow anonymous inserts for offline sync (race was created locally)
-- The sync endpoint will use service role key, so these policies
-- just need to not block the primary use case.

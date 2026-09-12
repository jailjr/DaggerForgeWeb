-- Production schema reference. Apply with a versioned migration runner.
create table campaigns (
  id uuid primary key,
  name varchar(120) not null,
  mode varchar(20) not null check (mode in ('PREPARATION','PLAY')),
  join_enabled boolean not null default true,
  gm_token_hash char(64) not null unique,
  player_token_hash char(64) not null unique,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create table participants (
  id uuid primary key,
  campaign_id uuid not null references campaigns(id),
  nickname varchar(60) not null,
  access_token_hash char(64) not null unique,
  character_id uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table characters (
  id uuid primary key,
  campaign_id uuid not null references campaigns(id),
  owner_id uuid references participants(id),
  name varchar(120) not null,
  configuration jsonb not null default '{}',
  runtime jsonb not null default '{}',
  private_notes text,
  version integer not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_owner_per_character on characters(id, owner_id);
create index participants_campaign_idx on participants(campaign_id);
create index characters_campaign_idx on characters(campaign_id);
create table audit_events (
  id uuid primary key,
  campaign_id uuid not null references campaigns(id),
  actor_id uuid,
  actor_role varchar(12) not null,
  nickname_snapshot varchar(60),
  operation varchar(80) not null,
  entity_type varchar(40) not null,
  entity_id uuid not null,
  field varchar(80),
  previous_value jsonb,
  new_value jsonb,
  session_id uuid,
  created_at timestamptz not null default now()
);
create index audit_campaign_time_idx on audit_events(campaign_id, created_at desc);

-- Development-compatible snapshot adapter used by server/postgres-store.js.
-- The normalized tables above are the long-term production schema; this table
-- provides a zero-downtime bridge while campaign repositories are migrated.
create table if not exists daggerforge_state (
  id integer primary key check (id = 1),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

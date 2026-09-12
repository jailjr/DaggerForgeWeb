-- Canonical normalized schema. Applied by server/migrations.js.
create table if not exists campaigns (
  id uuid primary key,
  name varchar(120) not null,
  mode varchar(20) not null check (mode in ('PREPARATION', 'PLAY')),
  join_enabled boolean not null default true,
  gm_token_hash char(64) not null unique,
  player_token_hash char(64) not null unique,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists participants (
  id uuid primary key,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  nickname varchar(60) not null,
  access_token_hash char(64) not null unique,
  character_id uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists characters (
  id uuid primary key,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  owner_id uuid references participants(id) on delete set null,
  name varchar(120) not null,
  configuration jsonb not null default '{}',
  runtime jsonb not null default '{}',
  private_notes text,
  version integer not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  actor_id varchar(120),
  actor_role varchar(12) not null,
  nickname_snapshot varchar(60),
  operation varchar(80) not null,
  entity_type varchar(40) not null,
  entity_id varchar(120) not null,
  field varchar(80),
  previous_value jsonb,
  new_value jsonb,
  session_id varchar(120),
  created_at timestamptz not null default now()
);

create table if not exists auth_sessions (
  id_hash char(64) primary key,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  actor_id varchar(120) not null,
  role varchar(12) not null,
  expires_at timestamptz not null
);

create table if not exists rate_limit_buckets (
  bucket_key text primary key,
  window_started timestamptz not null,
  hit_count integer not null
);

create index if not exists participants_campaign_idx on participants(campaign_id);
create index if not exists characters_campaign_idx on characters(campaign_id);
create index if not exists audit_campaign_time_idx on audit_events(campaign_id, created_at desc);
create index if not exists auth_sessions_expiry_idx on auth_sessions(expires_at);

-- Adopt databases created by the pre-migration inline schema. This migration
-- only adds or widens fields; it never deletes campaign or participant data.
alter table campaigns add column if not exists metadata jsonb not null default '{}';
alter table audit_events add column if not exists nickname_snapshot varchar(60);
alter table audit_events add column if not exists session_id varchar(120);
alter table audit_events alter column actor_id type varchar(120) using actor_id::text;
alter table audit_events alter column entity_id type varchar(120) using entity_id::text;
create index if not exists auth_sessions_expiry_idx on auth_sessions(expires_at);

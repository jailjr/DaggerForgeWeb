-- Preserve readable grouped operation text for the Event Console.
alter table audit_events add column if not exists summary varchar(500);

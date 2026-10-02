-- When each background job last finished, so the status page can tell "ran" from "silently stopped".
-- RLS on with no policies: only the service role (the edge function) can read or write it.
create table heartbeats (name text primary key, at timestamptz not null default now());

alter table heartbeats enable row level security;

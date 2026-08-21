-- runs: one row per scored call. id is the shareable URL (/runs/[id]).
-- No auth in this app - anyone with the URL can view a run, matching the
-- exercise's "I send that link to a colleague and they see the same
-- evaluation" requirement. RLS is enabled with NO policies: the anon/public
-- key therefore cannot read or write this table at all. Only server-side API
-- routes, authenticated with the service_role/secret key (which bypasses RLS
-- entirely), can touch it.

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  call_type text not null check (call_type in ('kickoff', 'coaching')),
  transcript text not null,
  -- sha256 of (call_type, transcript) - see src/lib/transcriptHash.ts. Lets
  -- the create-run flow check for an exact-duplicate submission (accidental
  -- double-click, literal re-paste) before spending ~$0.10 and ~60-90s
  -- re-running the pipeline on identical input. Not fuzzy/near-duplicate
  -- matching - only a byte-identical transcript hashes the same.
  transcript_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'complete', 'failed')),
  error text,
  model text,
  report jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists runs_transcript_hash_idx on runs (transcript_hash);

alter table runs enable row level security;
-- Deliberately no policies: RLS on + zero policies = the table is invisible
-- to anon/public. Server code uses the service_role key, which bypasses RLS.

-- Keep updated_at accurate on every write without the app having to remember to set it.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists runs_set_updated_at on runs;
create trigger runs_set_updated_at
  before update on runs
  for each row
  execute function set_updated_at();

create table if not exists public.project_workspace (
  id text primary key check (id = 'shared'),
  projects jsonb not null,
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.project_workspace enable row level security;

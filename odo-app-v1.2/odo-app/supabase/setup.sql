-- =====================================================================
--  ODO — Supabase setup. Paste this whole file into
--  Supabase → SQL Editor → New query → Run.  Safe to run more than once.
-- =====================================================================

-- 1. PROFILES — one row per user. Holds subscription status.
--    Users can READ their own row but never change it; only the Stripe
--    webhook (service role) writes plan / pro_until.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free',              -- 'free' | 'pro'
  pro_until timestamptz,                          -- end of current paid/trial period
  sub_status text,                                -- trialing | active | past_due | canceled | cancel_at_period_end
  stripe_customer_id text unique,
  stripe_subscription_id text,
  note text,                                      -- your own notes, e.g. "comp — beta tester"
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);

-- Create a profile automatically when someone signs up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. LEDGERS — the backup copy of each user's shifts, expenses and settings.
create table if not exists public.ledgers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  client_updated_at bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.ledgers enable row level security;
drop policy if exists "own ledger" on public.ledgers;
create policy "own ledger" on public.ledgers for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. SUPPORT TICKETS — sent from the app's Help & support screen.
--    Users can create and read their own. You reply by editing
--    admin_reply + status in the Table Editor; the user sees it in the app.
create table if not exists public.support_tickets (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  subject text,
  message text not null,
  diagnostics jsonb,
  status text not null default 'open',            -- open | in_progress | waiting_on_user | resolved | closed
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
drop policy if exists "create own ticket" on public.support_tickets;
create policy "create own ticket" on public.support_tickets for insert
  with check (auth.uid() = user_id and status = 'open' and admin_reply is null);
drop policy if exists "read own tickets" on public.support_tickets;
create policy "read own tickets" on public.support_tickets for select using (auth.uid() = user_id);

-- 4. HANDY VIEWS for you (only visible in the dashboard, not to app users)
create or replace view public.admin_subscribers with (security_invoker = true) as
  select email, plan, sub_status, pro_until, created_at, note
  from public.profiles order by created_at desc;

create or replace view public.admin_open_tickets with (security_invoker = true) as
  select id, created_at, email, subject, message, status,
         diagnostics->>'appVersion' as app_version,
         diagnostics->>'plan' as plan,
         diagnostics->>'device' as device
  from public.support_tickets
  where status not in ('resolved', 'closed')
  order by created_at;

-- Lock the views away from the public API
revoke all on public.admin_subscribers from anon, authenticated;
revoke all on public.admin_open_tickets from anon, authenticated;

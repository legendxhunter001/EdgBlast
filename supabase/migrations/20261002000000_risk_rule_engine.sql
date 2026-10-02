-- Edge Blast: Risk Engine + Rule Engine (+ strategy rules)
-- Writes to evaluations / locks / audit happen ONLY via Edge Function (service role).
-- Clients can read their own rows and edit their own rules. Nothing else.

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ───────────── Account-level rules ─────────────
create table if not exists public.risk_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid,                                  -- null = default for all accounts
  max_risk_per_trade_pct numeric(5,2) not null default 1   check (max_risk_per_trade_pct > 0 and max_risk_per_trade_pct <= 100),
  max_daily_loss_pct     numeric(5,2) not null default 3   check (max_daily_loss_pct > 0 and max_daily_loss_pct <= 100),
  max_weekly_loss_pct    numeric(5,2) not null default 6   check (max_weekly_loss_pct > 0 and max_weekly_loss_pct <= 100),
  min_rr                 numeric(5,2) not null default 1.5 check (min_rr >= 0),
  max_trades_per_day     int          default 3            check (max_trades_per_day is null or max_trades_per_day > 0),
  max_open_positions     int          default 3            check (max_open_positions is null or max_open_positions > 0),
  max_lot_size           numeric(8,2)                      check (max_lot_size is null or max_lot_size > 0),
  require_stop_loss      boolean not null default true,
  require_strategy       boolean not null default true,
  allowed_sessions       text[],                           -- asia | london | new_york (null = any)
  allowed_symbols        text[],
  allowed_strategy_ids   uuid[],
  cooldown_losses        int          default 2,           -- N consecutive losses...
  cooldown_minutes       int          default 120,         -- ...locks new trades for M minutes
  warn_at_pct            int not null default 80 check (warn_at_pct between 1 and 100),
  day_reset_offset_minutes int not null default 0 check (day_reset_offset_minutes between -720 and 840), -- minutes added to UTC for your daily reset clock (MT5 server UTC+3 = 180)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists risk_rules_user_account_uidx
  on public.risk_rules (user_id, coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid));
create trigger risk_rules_updated before update on public.risk_rules
  for each row execute function public.set_updated_at();

-- ───────────── Per-strategy rules ─────────────
create table if not exists public.strategy_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  strategy_id uuid not null,                        -- add FK to your strategies table once confirmed
  name text not null,
  enabled boolean not null default true,
  enforcement text not null default 'block' check (enforcement in ('block','warn')),
  min_rr numeric(5,2) check (min_rr is null or min_rr >= 0),
  max_risk_pct numeric(5,2) check (max_risk_pct is null or (max_risk_pct > 0 and max_risk_pct <= 100)),
  max_trades_per_day int check (max_trades_per_day is null or max_trades_per_day > 0),
  allowed_sessions text[],
  allowed_symbols text[],
  allowed_timeframes text[],
  required_confirmations text[] not null default '{}',
  require_screenshot boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, strategy_id)
);
create trigger strategy_rules_updated before update on public.strategy_rules
  for each row execute function public.set_updated_at();

-- ───────────── Locks (server-written only) ─────────────
create table if not exists public.trading_locks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid,
  reason text not null,
  until timestamptz not null,
  released_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists trading_locks_active_idx on public.trading_locks (user_id, until) where released_at is null;

-- ───────────── Evaluations: the gate every order must pass through ─────────────
create table if not exists public.rule_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  verdict text not null check (verdict in ('PASS','WARNING','BLOCKED')),
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index if not exists rule_evaluations_user_idx on public.rule_evaluations (user_id, created_at desc);

create table if not exists public.risk_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid,
  event text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ───────────── RLS ─────────────
alter table public.risk_rules        enable row level security;
alter table public.strategy_rules    enable row level security;
alter table public.trading_locks     enable row level security;
alter table public.rule_evaluations  enable row level security;
alter table public.risk_audit_log    enable row level security;

create policy "own risk_rules"     on public.risk_rules     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own strategy_rules" on public.strategy_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "read own locks"       on public.trading_locks    for select using (auth.uid() = user_id);
create policy "read own evaluations" on public.rule_evaluations for select using (auth.uid() = user_id);
create policy "read own audit"       on public.risk_audit_log   for select using (auth.uid() = user_id);
-- No insert/update/delete policies on locks/evaluations/audit: only the service role can write them.

-- ───────────── Order gate ─────────────
-- The future `place-order` function calls this. It atomically burns the evaluation (single use,
-- short-lived, never BLOCKED) and returns the EXACT input that was evaluated, so the order sent
-- to MT5 cannot differ from what the rule engine approved.
create or replace function public.consume_evaluation(p_id uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.rule_evaluations;
begin
  update public.rule_evaluations
     set consumed_at = now()
   where id = p_id and user_id = p_user
     and consumed_at is null and expires_at > now() and verdict <> 'BLOCKED'
  returning * into r;
  if not found then raise exception 'evaluation_invalid_or_expired'; end if;
  insert into public.risk_audit_log(user_id, account_id, event, detail)
  values (p_user, r.account_id, 'evaluation_consumed', jsonb_build_object('evaluation_id', r.id, 'verdict', r.verdict));
  return r.input;
end $$;
revoke all on function public.consume_evaluation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_evaluation(uuid, uuid) to service_role;

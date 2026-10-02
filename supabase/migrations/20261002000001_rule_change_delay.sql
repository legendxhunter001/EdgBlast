-- Edge Blast: 24h delay on LOOSENING rules. Tightening is instant.
-- Why: the dangerous moment is mid-session, after a loss, when "just this once" feels reasonable.
-- A trader can still change any rule, but a looser value only takes effect 24h after the request.
-- Enforced in the database (triggers), so the frontend cannot bypass it.

create or replace function public.rule_change_delay() returns interval
language sql immutable as $$ select interval '24 hours' $$;

-- Strategy created today can't be traded today (otherwise "make a new rule-less strategy" is a loophole).
alter table public.strategy_rules add column if not exists active_from timestamptz not null default now();

create table if not exists public.risk_rule_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_table text not null check (rule_table in ('risk_rules','strategy_rules')),
  rule_id uuid not null,
  changes jsonb not null,              -- field -> requested (looser) value
  requested_at timestamptz not null default now(),
  effective_at timestamptz not null,
  applied_at timestamptz,
  cancelled_at timestamptz
);
create index if not exists risk_rule_changes_pending_idx on public.risk_rule_changes (user_id, effective_at)
  where applied_at is null and cancelled_at is null;
alter table public.risk_rule_changes enable row level security;
create policy "read own rule changes" on public.risk_rule_changes for select using (auth.uid() = user_id);

-- No deleting rules (deleting = loosening with zero delay). Edit instead.
drop policy if exists "own risk_rules" on public.risk_rules;
drop policy if exists "own strategy_rules" on public.strategy_rules;
create policy "read own risk_rules"   on public.risk_rules for select using (auth.uid() = user_id);
create policy "insert own risk_rules" on public.risk_rules for insert with check (auth.uid() = user_id);
create policy "update own risk_rules" on public.risk_rules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "read own strategy_rules"   on public.strategy_rules for select using (auth.uid() = user_id);
create policy "insert own strategy_rules" on public.strategy_rules for insert with check (auth.uid() = user_id);
create policy "update own strategy_rules" on public.strategy_rules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────── "is the new value looser?" helpers ─────────
create or replace function public._looser_max(o numeric, n numeric) returns boolean language sql immutable as
$$ select o is not null and (n is null or n > o) $$;                 -- upper limit: raising or removing it
create or replace function public._looser_min(o numeric, n numeric) returns boolean language sql immutable as
$$ select o is not null and (n is null or n < o) $$;                 -- lower limit: lowering or removing it
create or replace function public._looser_list(o text[], n text[]) returns boolean language sql immutable as   -- allow-list: widening or removing it
$$ select coalesce(array_length(o,1),0) > 0 and (coalesce(array_length(n,1),0) = 0
     or exists (select 1 from unnest(n) x where lower(x) <> all (array(select lower(y) from unnest(o) y)))) $$;
create or replace function public._removed_any(o text[], n text[]) returns boolean language sql immutable as   -- required list: dropping an item
$$ select exists (select 1 from unnest(coalesce(o,'{}')) x where lower(x) <> all (array(select lower(y) from unnest(coalesce(n,'{}')) y))) $$;

create or replace function public._risk_loosened(o public.risk_rules, n public.risk_rules) returns text[]
language sql immutable as $$
  select array_remove(array[
    case when _looser_max(o.max_risk_per_trade_pct, n.max_risk_per_trade_pct) then 'max_risk_per_trade_pct' end,
    case when _looser_max(o.max_daily_loss_pct,     n.max_daily_loss_pct)     then 'max_daily_loss_pct' end,
    case when _looser_max(o.max_weekly_loss_pct,    n.max_weekly_loss_pct)    then 'max_weekly_loss_pct' end,
    case when _looser_min(o.min_rr,                 n.min_rr)                 then 'min_rr' end,
    case when _looser_max(o.max_trades_per_day,     n.max_trades_per_day)     then 'max_trades_per_day' end,
    case when _looser_max(o.max_open_positions,     n.max_open_positions)     then 'max_open_positions' end,
    case when _looser_max(o.max_lot_size,           n.max_lot_size)           then 'max_lot_size' end,
    case when o.require_stop_loss and not n.require_stop_loss                 then 'require_stop_loss' end,
    case when o.require_strategy and not n.require_strategy                   then 'require_strategy' end,
    case when _looser_list(o.allowed_sessions, n.allowed_sessions)            then 'allowed_sessions' end,
    case when _looser_list(o.allowed_symbols,  n.allowed_symbols)             then 'allowed_symbols' end,
    case when _looser_list(o.allowed_strategy_ids::text[], n.allowed_strategy_ids::text[]) then 'allowed_strategy_ids' end,
    case when _looser_max(o.cooldown_losses,        n.cooldown_losses)        then 'cooldown_losses' end,
    case when _looser_min(o.cooldown_minutes,       n.cooldown_minutes)       then 'cooldown_minutes' end,
    case when _looser_max(o.warn_at_pct,            n.warn_at_pct)            then 'warn_at_pct' end,
    case when o.day_reset_offset_minutes is distinct from n.day_reset_offset_minutes then 'day_reset_offset_minutes' end  -- moving the reset clock can dodge a loss budget
  ], null)
$$;

create or replace function public._strategy_loosened(o public.strategy_rules, n public.strategy_rules) returns text[]
language sql immutable as $$
  select array_remove(array[
    case when not o.enabled and n.enabled                                     then 'enabled' end,
    case when o.enforcement = 'block' and n.enforcement = 'warn'              then 'enforcement' end,
    case when _looser_min(o.min_rr,              n.min_rr)                    then 'min_rr' end,
    case when _looser_max(o.max_risk_pct,        n.max_risk_pct)              then 'max_risk_pct' end,
    case when _looser_max(o.max_trades_per_day,  n.max_trades_per_day)        then 'max_trades_per_day' end,
    case when _looser_list(o.allowed_sessions,   n.allowed_sessions)          then 'allowed_sessions' end,
    case when _looser_list(o.allowed_symbols,    n.allowed_symbols)           then 'allowed_symbols' end,
    case when _looser_list(o.allowed_timeframes, n.allowed_timeframes)        then 'allowed_timeframes' end,
    case when _removed_any(o.required_confirmations, n.required_confirmations) then 'required_confirmations' end,
    case when o.require_screenshot and not n.require_screenshot               then 'require_screenshot' end
  ], null)
$$;

-- ───────── guards ─────────
-- Shared tail: cancels/supersedes pending changes for any field the user just touched,
-- reverts loosened fields to their current value, and queues the requested value.
create or replace function public._queue_loosening(p_table text, p_user uuid, p_id uuid, o jsonb, n jsonb, loosened text[], ignore text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare changed text[]; payload jsonb; revert jsonb;
begin
  select coalesce(array_agg(k), '{}') into changed
    from jsonb_object_keys(n) k
   where k <> all (ignore) and n -> k is distinct from o -> k;

  -- Touching a field replaces any older pending request for it (so tightening cancels a queued loosening).
  update risk_rule_changes set changes = changes - changed
   where rule_table = p_table and rule_id = p_id and applied_at is null and cancelled_at is null;
  update risk_rule_changes set cancelled_at = now()
   where rule_table = p_table and rule_id = p_id and applied_at is null and cancelled_at is null and changes = '{}'::jsonb;

  if coalesce(array_length(loosened, 1), 0) > 0 then
    select jsonb_object_agg(f, n -> f), jsonb_object_agg(f, o -> f) into payload, revert from unnest(loosened) f;
    insert into risk_rule_changes(user_id, rule_table, rule_id, changes, effective_at)
    values (p_user, p_table, p_id, payload, now() + rule_change_delay());
    return revert;
  end if;
  return '{}'::jsonb;
end $$;
revoke all on function public._queue_loosening(text, uuid, uuid, jsonb, jsonb, text[], text[]) from public, anon, authenticated;

create or replace function public.risk_rules_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.risk_rules; revert jsonb;
begin
  if current_setting('edgeblast.applying', true) = '1' then return new; end if;
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id or new.account_id is distinct from old.account_id then raise exception 'rule_identity_immutable'; end if;
    o := old;
  else
    -- first-ever setup is free (onboarding). A new per-account row is compared against the user's default row.
    if new.account_id is null then return new; end if;
    select * into o from public.risk_rules where user_id = new.user_id and account_id is null;
    if not found then return new; end if;
  end if;
  revert := public._queue_loosening('risk_rules', new.user_id, new.id, to_jsonb(o), to_jsonb(new), public._risk_loosened(o, new),
                                    array['id','user_id','account_id','created_at','updated_at']);
  if revert <> '{}'::jsonb then new := jsonb_populate_record(new, revert); end if;
  return new;
end $$;
drop trigger if exists risk_rules_guard on public.risk_rules;
create trigger risk_rules_guard before insert or update on public.risk_rules for each row execute function public.risk_rules_guard();

create or replace function public.strategy_rules_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.strategy_rules; revert jsonb;
begin
  if current_setting('edgeblast.applying', true) = '1' then return new; end if;
  if tg_op = 'INSERT' then
    -- first strategy is free; every later one can't be traded for 24h
    if exists (select 1 from public.strategy_rules where user_id = new.user_id) then new.active_from := now() + public.rule_change_delay();
    else new.active_from := now(); end if;
    return new;
  end if;
  if new.user_id <> old.user_id or new.strategy_id <> old.strategy_id then raise exception 'rule_identity_immutable'; end if;
  new.active_from := old.active_from;
  o := old;
  revert := public._queue_loosening('strategy_rules', new.user_id, new.id, to_jsonb(o), to_jsonb(new), public._strategy_loosened(o, new),
                                    array['id','user_id','strategy_id','name','active_from','created_at','updated_at']);
  if revert <> '{}'::jsonb then new := jsonb_populate_record(new, revert); end if;
  return new;
end $$;
drop trigger if exists strategy_rules_guard on public.strategy_rules;
create trigger strategy_rules_guard before insert or update on public.strategy_rules for each row execute function public.strategy_rules_guard();

-- ───────── apply due changes (called lazily by evaluate-trade, or by the settings page) ─────────
create or replace function public.apply_due_rule_changes(p_user uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_user uuid := coalesce(auth.uid(), p_user); c record; k text; n int := 0;
begin
  if v_user is null then raise exception 'no_user'; end if;
  if auth.uid() is not null and p_user is not null and p_user <> auth.uid() then raise exception 'forbidden'; end if;
  perform set_config('edgeblast.applying', '1', true);
  for c in select * from risk_rule_changes
            where user_id = v_user and applied_at is null and cancelled_at is null and effective_at <= now()
            order by requested_at, id for update loop
    for k in select jsonb_object_keys(c.changes) loop
      if c.rule_table = 'risk_rules' then
        execute format('update public.risk_rules set %I = (jsonb_populate_record(null::public.risk_rules, $1)).%I where id = $2 and user_id = $3', k, k) using c.changes, c.rule_id, v_user;
      else
        execute format('update public.strategy_rules set %I = (jsonb_populate_record(null::public.strategy_rules, $1)).%I where id = $2 and user_id = $3', k, k) using c.changes, c.rule_id, v_user;
      end if;
    end loop;
    update risk_rule_changes set applied_at = now() where id = c.id;
    n := n + 1;
  end loop;
  perform set_config('edgeblast.applying', '0', true);
  return n;
end $$;
revoke all on function public.apply_due_rule_changes(uuid) from public, anon;
grant execute on function public.apply_due_rule_changes(uuid) to authenticated, service_role;

create or replace function public.cancel_rule_change(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.risk_rule_changes set cancelled_at = now()
   where id = p_id and user_id = auth.uid() and applied_at is null and cancelled_at is null
$$;
revoke all on function public.cancel_rule_change(uuid) from public, anon;
grant execute on function public.cancel_rule_change(uuid) to authenticated;

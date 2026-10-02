-- Plain-SQL test. Run on a scratch DB after applying both migrations (needs auth.users + auth.uid() stubs outside Supabase).
\set ON_ERROR_STOP on
do $$
declare u uuid := gen_random_uuid(); a uuid := gen_random_uuid(); rid uuid; sid1 uuid; sid2 uuid; v numeric; cnt int;
begin
  insert into auth.users(id) values (u);
  perform set_config('request.jwt.claim.sub', u::text, true);

  -- onboarding: first rules row is free
  insert into risk_rules(user_id, max_daily_loss_pct, min_rr) values (u, 3, 2) returning id into rid;

  -- tightening = instant
  update risk_rules set max_daily_loss_pct = 2 where id = rid;
  select max_daily_loss_pct into v from risk_rules where id = rid; assert v = 2, 'tighten should apply instantly';

  -- loosening = queued, value unchanged
  update risk_rules set max_daily_loss_pct = 5, min_rr = 1 where id = rid;
  select max_daily_loss_pct into v from risk_rules where id = rid; assert v = 2, 'loosen must not apply';
  select min_rr into v from risk_rules where id = rid; assert v = 2, 'min_rr loosen must not apply';
  select count(*) into cnt from risk_rule_changes where rule_id = rid and applied_at is null; assert cnt = 1, 'one pending row';

  -- applying before the delay does nothing
  assert apply_due_rule_changes() = 0, 'nothing due yet';

  -- tightening a field cancels its pending loosening; the other pending field survives
  update risk_rules set max_daily_loss_pct = 1.5 where id = rid;
  assert (select changes ? 'max_daily_loss_pct' from risk_rule_changes where rule_id = rid and cancelled_at is null) is not true, 'pending daily cancelled';
  assert (select changes ? 'min_rr' from risk_rule_changes where rule_id = rid and cancelled_at is null), 'pending min_rr kept';

  -- after 24h it applies
  update risk_rule_changes set effective_at = now() - interval '1 minute' where rule_id = rid;
  assert apply_due_rule_changes() = 1, 'one applied';
  select min_rr into v from risk_rules where id = rid; assert v = 1, 'min_rr loosened after delay';
  select max_daily_loss_pct into v from risk_rules where id = rid; assert v = 1.5, 'daily stays tightened';

  -- identity can't be changed
  begin update risk_rules set user_id = gen_random_uuid() where id = rid; assert false, 'should have raised';
  exception when others then assert sqlerrm = 'rule_identity_immutable', sqlerrm; end;

  -- strategies: first is free, second is delayed
  insert into strategy_rules(user_id, strategy_id, name) values (u, gen_random_uuid(), 'A') returning id into sid1;
  insert into strategy_rules(user_id, strategy_id, name) values (u, gen_random_uuid(), 'B') returning id into sid2;
  assert (select active_from <= now() from strategy_rules where id = sid1), 'first strategy active now';
  assert (select active_from > now() + interval '23 hours' from strategy_rules where id = sid2), 'second strategy delayed';

  -- strategy: removing a required confirmation and block->warn are loosening
  update strategy_rules set required_confirmations = '{Engulfing,FVG}', enforcement = 'block', min_rr = 2 where id = sid1;
  update strategy_rules set required_confirmations = '{Engulfing}', enforcement = 'warn', min_rr = 1 where id = sid1;
  assert (select required_confirmations = '{Engulfing,FVG}' and enforcement = 'block' and min_rr = 2 from strategy_rules where id = sid1), 'strategy loosening queued';
  -- adding a confirmation (tightening) is instant
  update strategy_rules set required_confirmations = '{Engulfing,FVG,Sweep}' where id = sid1;
  assert (select required_confirmations = '{Engulfing,FVG,Sweep}' from strategy_rules where id = sid1), 'strategy tighten instant';
  update risk_rule_changes set effective_at = now() - interval '1 minute' where rule_id = sid1;
  perform apply_due_rule_changes();
  assert (select enforcement = 'warn' and min_rr = 1 from strategy_rules where id = sid1), 'strategy loosening applied after delay';

  raise notice 'ALL RULE-CHANGE-DELAY TESTS PASSED';
end $$;

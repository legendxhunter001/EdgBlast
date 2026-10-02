-- Fit the engine to the existing Edge Blast schema (applied to production as `risk_engine_schema_fit`).
alter table public.strategy_rules
  add constraint strategy_rules_strategy_id_fkey foreign key (strategy_id) references public.strategies(id) on delete cascade;
create index if not exists strategy_rules_strategy_idx on public.strategy_rules (strategy_id);

revoke all on function public.risk_rules_guard() from public, anon, authenticated;
revoke all on function public.strategy_rules_guard() from public, anon, authenticated;

create index if not exists trades_conn_exit_idx  on public.trades (user_id, mt5_connection_id, exit_at desc) where status = 'closed';
create index if not exists trades_conn_entry_idx on public.trades (user_id, mt5_connection_id, entry_at desc);

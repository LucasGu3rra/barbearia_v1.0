-- Cover the foreign keys introduced by plan-cycle tracking.

create index if not exists agendamentos_assinatura_id_idx
  on public.agendamentos (assinatura_id)
  where assinatura_id is not null;

create index if not exists historico_cortes_assinatura_id_idx
  on public.historico_cortes (assinatura_id)
  where assinatura_id is not null;

create index if not exists assinatura_ciclos_cliente_id_idx
  on public.assinatura_ciclos (cliente_id);

create index if not exists assinatura_ciclos_plano_id_idx
  on public.assinatura_ciclos (plano_id)
  where plano_id is not null;

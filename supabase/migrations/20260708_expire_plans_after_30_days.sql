create or replace function app_private.executar_manutencao_sistema()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'app_private', 'pg_temp'
as $function$
declare
  v_assinaturas_expiradas integer := 0;
  v_agendamentos_finalizados integer := 0;
  v_notificacoes_removidas integer := 0;
  v_rate_limits_removidos integer := 0;
begin
  update public.assinaturas
  set status = 'inativa'
  where status = 'ativa'
    and data_vencimento is not null
    and data_vencimento < now() - interval '30 days';
  get diagnostics v_assinaturas_expiradas = row_count;

  update public.agendamentos a
  set status = 'finalizado'
  where a.status in ('agendado', 'confirmado', 'pendente')
    and (
      a.data_hora
      + make_interval(mins => coalesce(a.duracao_minutos, 30))
    ) <= now();
  get diagnostics v_agendamentos_finalizados = row_count;

  delete from public.notificacoes
  where lida = true
     or created_at < now() - interval '5 hours';
  get diagnostics v_notificacoes_removidas = row_count;

  delete from public.cadastro_rate_limits
  where updated_at < now() - interval '24 hours'
    and (blocked_until is null or blocked_until < now());
  get diagnostics v_rate_limits_removidos = row_count;

  return jsonb_build_object(
    'assinaturas_expiradas', v_assinaturas_expiradas,
    'agendamentos_finalizados', v_agendamentos_finalizados,
    'notificacoes_removidas', v_notificacoes_removidas,
    'cadastro_rate_limits_removidos', v_rate_limits_removidos,
    'executado_em', now()
  );
end;
$function$;

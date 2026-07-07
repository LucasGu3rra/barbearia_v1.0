create or replace function app_private.cancelar_agendamento_cliente(p_agendamento_id uuid)
returns public.agendamentos
language plpgsql
security definer
set search_path to 'public', 'app_private'
as $function$
declare
  v_cliente_id uuid := auth.uid();
  v_agendamento public.agendamentos;
  v_prazo integer := 120;
  v_tolerancia_arrependimento integer := 5;
  v_cancelamento_normal boolean := false;
  v_cancelamento_arrependimento boolean := false;
begin
  if v_cliente_id is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  select * into v_agendamento
  from public.agendamentos a
  where a.id = p_agendamento_id
    and a.cliente_id = v_cliente_id
    and coalesce(a.status, 'agendado') not in ('cancelado', 'cancelada', 'finalizado', 'concluido')
  limit 1;

  if v_agendamento.id is null then
    raise exception 'agendamento_nao_encontrado' using errcode = 'P0001';
  end if;

  if not app_private.usuario_cliente_empresa(v_agendamento.empresa_id) then
    raise exception 'cliente_sem_acesso_empresa' using errcode = 'P0001';
  end if;

  select coalesce((c.valor ->> 'prazo_cancelamento_minutos')::integer, (c.valor ->> 'cancelamento_minutos')::integer, 120)
    into v_prazo
  from public.configuracoes c
  where c.empresa_id = v_agendamento.empresa_id
    and c.chave = 'fluxo_agendamento'
  limit 1;

  v_prazo := greatest(coalesce(v_prazo, 120), 0);

  v_cancelamento_normal := now() <= (v_agendamento.data_hora - make_interval(mins => v_prazo));
  v_cancelamento_arrependimento :=
    v_agendamento.tipo_cliente = 'assinante'
    and v_agendamento.created_at is not null
    and now() <= least(
      v_agendamento.created_at + make_interval(mins => v_tolerancia_arrependimento),
      v_agendamento.data_hora
    );

  if not (v_cancelamento_normal or v_cancelamento_arrependimento) then
    raise exception 'cancelamento_agendamento_indisponivel' using errcode = 'P0001';
  end if;

  update public.agendamentos a
  set status = 'cancelado'
  where a.id = v_agendamento.id
  returning * into v_agendamento;

  return v_agendamento;
end;
$function$;

revoke execute on function app_private.cancelar_agendamento_cliente(uuid) from public, anon;
grant execute on function app_private.cancelar_agendamento_cliente(uuid) to authenticated;

create or replace function app_private.solicitar_plano_cliente(
  p_empresa_id uuid,
  p_plano_slug text
)
returns public.assinaturas
language plpgsql
security definer
set search_path to 'public', 'app_private', 'pg_temp'
as $function$
declare
  v_cliente_id uuid := auth.uid();
  v_plano public.planos;
  v_plano_agendado public.planos;
  v_assinatura public.assinaturas;
begin
  if v_cliente_id is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  if app_private.usuario_cliente_empresa(p_empresa_id) is not true then
    raise exception 'cliente_sem_acesso_empresa' using errcode = 'P0001';
  end if;

  select * into v_assinatura
  from public.assinaturas a
  where a.empresa_id = p_empresa_id
    and a.cliente_id = v_cliente_id
  order by a.created_at desc
  limit 1
  for update;

  if v_assinatura.id is not null
     and v_assinatura.status = 'ativa'
     and v_assinatura.data_vencimento >= now() then
    raise exception 'plano_ativo_ja_existente' using errcode = 'P0001';
  end if;

  if v_assinatura.id is not null
     and v_assinatura.proximo_plano is not null
     and v_assinatura.data_vencimento is not null
     and v_assinatura.data_vencimento < now() then
    select * into v_plano_agendado
    from public.planos p
    where p.empresa_id = p_empresa_id
      and p.slug = v_assinatura.proximo_plano
      and p.ativo = true
      and p.deleted_at is null
    limit 1;
  end if;

  if v_plano_agendado.id is not null then
    v_plano := v_plano_agendado;
  else
    select * into v_plano
    from public.planos p
    where p.empresa_id = p_empresa_id
      and p.slug = btrim(p_plano_slug)
      and p.ativo = true
      and p.deleted_at is null
    limit 1;
  end if;

  if v_plano.id is null then
    raise exception 'plano_indisponivel' using errcode = 'P0001';
  end if;

  if v_assinatura.id is null then
    insert into public.assinaturas (
      empresa_id,
      cliente_id,
      plano_escolhido,
      status,
      ativada_em,
      data_vencimento,
      proximo_plano,
      upgrade_pendente
    ) values (
      p_empresa_id,
      v_cliente_id,
      v_plano.slug,
      'pendente',
      null,
      null,
      null,
      null
    )
    returning * into v_assinatura;
  else
    update public.assinaturas a
    set plano_escolhido = v_plano.slug,
        status = 'pendente',
        ativada_em = null,
        data_vencimento = null,
        proximo_plano = null,
        upgrade_pendente = null
    where a.id = v_assinatura.id
    returning * into v_assinatura;
  end if;

  return v_assinatura;
end;
$function$;

revoke execute on function app_private.solicitar_plano_cliente(uuid, text)
  from public, anon;
grant execute on function app_private.solicitar_plano_cliente(uuid, text)
  to authenticated;

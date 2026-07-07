create or replace function app_private.confirmar_upgrade_plano(p_assinatura_id uuid)
returns public.assinaturas
language plpgsql
security definer
set search_path to 'public', 'app_private', 'pg_temp'
as $function$
declare
  v_assinatura public.assinaturas;
  v_plano_atual public.planos;
  v_plano_novo public.planos;
begin
  if p_assinatura_id is null then
    raise exception 'assinatura_obrigatoria' using errcode = 'P0001';
  end if;

  select * into v_assinatura
  from public.assinaturas a
  where a.id = p_assinatura_id
  for update;

  if v_assinatura.id is null then
    raise exception 'assinatura_nao_encontrada' using errcode = 'P0001';
  end if;

  if app_private.usuario_admin_empresa(v_assinatura.empresa_id) is not true then
    raise exception 'acesso_negado' using errcode = 'P0001';
  end if;

  if v_assinatura.status <> 'ativa'
     or v_assinatura.plano_escolhido is null
     or (v_assinatura.data_vencimento is not null and v_assinatura.data_vencimento < now()) then
    raise exception 'plano_ativo_nao_encontrado' using errcode = 'P0001';
  end if;

  if v_assinatura.upgrade_pendente is null or btrim(v_assinatura.upgrade_pendente) = '' then
    raise exception 'upgrade_pendente_nao_encontrado' using errcode = 'P0001';
  end if;

  select * into v_plano_atual
  from public.planos p
  where p.empresa_id = v_assinatura.empresa_id
    and p.slug = v_assinatura.plano_escolhido
    and p.deleted_at is null
  limit 1;

  select * into v_plano_novo
  from public.planos p
  where p.empresa_id = v_assinatura.empresa_id
    and p.slug = v_assinatura.upgrade_pendente
    and p.ativo = true
    and p.deleted_at is null
  limit 1;

  if v_plano_novo.id is null then
    raise exception 'plano_indisponivel' using errcode = 'P0001';
  end if;

  if v_plano_atual.id is not null
     and coalesce(v_plano_novo.preco, 0) <= coalesce(v_plano_atual.preco, 0) then
    raise exception 'upgrade_invalido' using errcode = 'P0001';
  end if;

  update public.assinaturas a
  set plano_escolhido = v_plano_novo.slug,
      upgrade_pendente = null,
      proximo_plano = null,
      status = 'ativa'
  where a.id = v_assinatura.id
  returning * into v_assinatura;

  return v_assinatura;
end;
$function$;

create or replace function public.confirmar_upgrade_plano(p_assinatura_id uuid)
returns public.assinaturas
language sql
set search_path to 'public', 'app_private', 'pg_temp'
as $function$
  select * from app_private.confirmar_upgrade_plano(p_assinatura_id);
$function$;

revoke execute on function public.confirmar_upgrade_plano(uuid) from public, anon;
grant execute on function public.confirmar_upgrade_plano(uuid) to authenticated, service_role;

revoke execute on function app_private.confirmar_upgrade_plano(uuid) from public, anon;
grant execute on function app_private.confirmar_upgrade_plano(uuid) to authenticated, service_role;

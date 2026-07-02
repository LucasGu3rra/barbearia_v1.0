create or replace function public.confirmar_pagamento_plano(p_assinatura_id uuid)
returns public.assinaturas
language plpgsql
security definer
set search_path to 'public', 'app_private', 'pg_temp'
as $function$
declare
  v_assinatura public.assinaturas;
  v_plano public.planos;
  v_agora timestamptz := now();
begin
  if p_assinatura_id is null then
    raise exception 'assinatura_obrigatoria' using errcode = 'P0001';
  end if;

  select *
  into v_assinatura
  from public.assinaturas a
  where a.id = p_assinatura_id
  for update;

  if v_assinatura.id is null then
    raise exception 'assinatura_nao_encontrada' using errcode = 'P0001';
  end if;

  if app_private.usuario_admin_empresa(v_assinatura.empresa_id) is not true then
    raise exception 'acesso_negado' using errcode = 'P0001';
  end if;

  if v_assinatura.plano_escolhido is null or btrim(v_assinatura.plano_escolhido) = '' then
    raise exception 'plano_nao_informado' using errcode = 'P0001';
  end if;

  select *
  into v_plano
  from public.planos p
  where p.empresa_id = v_assinatura.empresa_id
    and p.slug = v_assinatura.plano_escolhido
    and p.ativo = true
    and p.deleted_at is null
  limit 1;

  if v_plano.id is null then
    raise exception 'plano_indisponivel' using errcode = 'P0001';
  end if;

  if v_assinatura.status = 'ativa'
     and v_assinatura.data_vencimento is not null
     and v_assinatura.data_vencimento >= v_agora then
    raise exception 'plano_ja_ativo' using errcode = 'P0001';
  end if;

  update public.assinaturas a
  set status = 'ativa',
      ativada_em = v_agora,
      data_vencimento = v_agora + interval '30 days',
      proximo_plano = null,
      upgrade_pendente = null
  where a.id = v_assinatura.id
  returning * into v_assinatura;

  return v_assinatura;
end;
$function$;

revoke execute on function public.confirmar_pagamento_plano(uuid) from public, anon;
grant execute on function public.confirmar_pagamento_plano(uuid) to authenticated, service_role;

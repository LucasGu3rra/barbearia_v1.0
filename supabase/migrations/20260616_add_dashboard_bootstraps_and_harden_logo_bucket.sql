create or replace function public.admin_dashboard_bootstrap(p_empresa_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public', 'app_private', 'pg_temp'
as $function$
begin
  if app_private.usuario_admin_empresa(p_empresa_id) is not true then
    raise exception 'Acesso negado ao painel admin';
  end if;

  return jsonb_build_object(
    'planos', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at)
      from public.planos p
      where p.empresa_id = p_empresa_id
    ), '[]'::jsonb),
    'configuracao', (
      select to_jsonb(c)
      from public.configuracoes c
      where c.empresa_id = p_empresa_id
        and c.chave = 'fluxo_agendamento'
      limit 1
    ),
    'clientes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'nome', c.nome,
          'whatsapp', c.whatsapp,
          'assinaturas', coalesce((
            select jsonb_agg(to_jsonb(a) order by a.created_at desc)
            from public.assinaturas a
            where a.empresa_id = p_empresa_id
              and a.cliente_id = c.id
          ), '[]'::jsonb)
        )
        order by c.nome
      )
      from public.clientes c
      where c.empresa_id = p_empresa_id
        and coalesce(c.eh_admin, false) = false
    ), '[]'::jsonb),
    'cortes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', h.id,
          'created_at', h.created_at,
          'tipo_corte', h.tipo_corte,
          'cliente_id', h.cliente_id,
          'status', h.status,
          'origem', h.origem,
          'cancelavel_ate', h.cancelavel_ate,
          'clientes', (
            select jsonb_build_object('nome', c.nome, 'whatsapp', c.whatsapp)
            from public.clientes c
            where c.id = h.cliente_id
              and c.empresa_id = h.empresa_id
          )
        )
        order by h.created_at desc
      )
      from public.historico_cortes h
      where h.empresa_id = p_empresa_id
    ), '[]'::jsonb),
    'agendamentos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'data_hora', a.data_hora,
          'status', a.status,
          'tipo_cliente', a.tipo_cliente,
          'created_at', a.created_at,
          'cliente_id', a.cliente_id,
          'clientes', (
            select jsonb_build_object('nome', c.nome, 'whatsapp', c.whatsapp)
            from public.clientes c
            where c.id = a.cliente_id
              and c.empresa_id = a.empresa_id
          ),
          'servicos', (
            select jsonb_build_object('nome', s.nome, 'preco', s.preco, 'duracao_minutos', s.duracao_minutos)
            from public.servicos s
            where s.id = a.servico_id
              and s.empresa_id = a.empresa_id
          ),
          'planos', (
            select jsonb_build_object('nome', p.nome, 'preco', p.preco, 'duracao_minutos', p.duracao_minutos)
            from public.planos p
            where p.id = a.plano_id
              and p.empresa_id = a.empresa_id
          ),
          'barbeiros', (
            select jsonb_build_object('nome', b.nome)
            from public.barbeiros b
            where b.id = a.barbeiro_id
              and b.empresa_id = a.empresa_id
          )
        )
        order by a.data_hora
      )
      from public.agendamentos a
      where a.empresa_id = p_empresa_id
    ), '[]'::jsonb)
  );
end;
$function$;

revoke execute on function public.admin_dashboard_bootstrap(uuid) from public, anon;
grant execute on function public.admin_dashboard_bootstrap(uuid) to authenticated, service_role;

create or replace function public.cliente_dashboard_bootstrap(p_empresa_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public', 'app_private', 'pg_temp'
as $function$
declare
  v_cliente_id uuid := auth.uid();
begin
  if app_private.usuario_cliente_empresa(p_empresa_id) is not true then
    raise exception 'Acesso negado ao painel do cliente';
  end if;

  return jsonb_build_object(
    'planos', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.preco)
      from public.planos p
      where p.empresa_id = p_empresa_id
    ), '[]'::jsonb),
    'servicos', coalesce((
      select jsonb_agg(
        to_jsonb(s)
        || jsonb_build_object(
          'servico_categorias', (
            select jsonb_build_object('nome', c.nome)
            from public.servico_categorias c
            where c.id = s.categoria_id
              and c.empresa_id = s.empresa_id
          ),
          'servico_subcategorias', (
            select jsonb_build_object('nome', sc.nome)
            from public.servico_subcategorias sc
            where sc.id = s.subcategoria_id
              and sc.empresa_id = s.empresa_id
          )
        )
        order by s.created_at
      )
      from public.servicos s
      where s.empresa_id = p_empresa_id
        and s.ativo = true
        and s.deleted_at is null
    ), '[]'::jsonb),
    'agendamentos', coalesce((
      select jsonb_agg(
        to_jsonb(a)
        || jsonb_build_object(
          'servicos', (
            select jsonb_build_object('nome', s.nome, 'preco', s.preco)
            from public.servicos s
            where s.id = a.servico_id
              and s.empresa_id = a.empresa_id
          ),
          'planos', (
            select jsonb_build_object('nome', p.nome, 'preco', p.preco)
            from public.planos p
            where p.id = a.plano_id
              and p.empresa_id = a.empresa_id
          ),
          'filiais', (
            select jsonb_build_object('nome', f.nome)
            from public.filiais f
            where f.id = a.filial_id
              and f.empresa_id = a.empresa_id
          ),
          'barbeiros', (
            select jsonb_build_object('nome', b.nome)
            from public.barbeiros b
            where b.id = a.barbeiro_id
              and b.empresa_id = a.empresa_id
          )
        )
        order by a.created_at desc
      )
      from public.agendamentos a
      where a.empresa_id = p_empresa_id
        and a.cliente_id = v_cliente_id
      limit 20
    ), '[]'::jsonb),
    'configuracao', (
      select to_jsonb(c)
      from public.configuracoes c
      where c.empresa_id = p_empresa_id
        and c.chave = 'fluxo_agendamento'
      limit 1
    ),
    'vinculo_empresa', (
      select to_jsonb(ue)
      from public.usuarios_empresas ue
      where ue.empresa_id = p_empresa_id
        and ue.user_id = v_cliente_id
      limit 1
    ),
    'cliente', (
      select to_jsonb(c)
        || jsonb_build_object(
          'assinaturas', coalesce((
            select jsonb_agg(to_jsonb(a) order by a.created_at desc)
            from public.assinaturas a
            where a.empresa_id = p_empresa_id
              and a.cliente_id = v_cliente_id
          ), '[]'::jsonb),
          'historico_cortes', coalesce((
            select jsonb_agg(to_jsonb(h) order by h.created_at desc)
            from public.historico_cortes h
            where h.empresa_id = p_empresa_id
              and h.cliente_id = v_cliente_id
          ), '[]'::jsonb)
        )
      from public.clientes c
      where c.empresa_id = p_empresa_id
        and c.id = v_cliente_id
      limit 1
    )
  );
end;
$function$;

revoke execute on function public.cliente_dashboard_bootstrap(uuid) from public, anon;
grant execute on function public.cliente_dashboard_bootstrap(uuid) to authenticated, service_role;

drop policy if exists "logos_empresas_public_read" on storage.objects;

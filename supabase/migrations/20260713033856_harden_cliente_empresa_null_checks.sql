do $migration$
declare
  v_funcao record;
  v_definicao text;
  v_definicao_corrigida text;
  v_total integer := 0;
begin
  for v_funcao in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prokind = 'f'
      and n.nspname = 'app_private'
      and lower(pg_get_functiondef(p.oid))
        like '%not app_private.usuario_cliente_empresa(%'
  loop
    v_definicao := pg_get_functiondef(v_funcao.oid);
    v_definicao_corrigida := regexp_replace(
      v_definicao,
      'if\s+not\s+app_private\.usuario_cliente_empresa\(([^()]*)\)\s+then',
      'if app_private.usuario_cliente_empresa(\1) is not true then',
      'gi'
    );

    if v_definicao_corrigida = v_definicao then
      raise exception 'falha_ao_corrigir_validacao_empresa_funcao_%', v_funcao.oid::regprocedure;
    end if;

    execute v_definicao_corrigida;
    v_total := v_total + 1;
  end loop;

  if v_total <> 7 then
    raise exception 'quantidade_inesperada_funcoes_validacao_empresa: %', v_total;
  end if;
end;
$migration$;

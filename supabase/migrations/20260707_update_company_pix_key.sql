create or replace function public.atualizar_chave_pix_empresa(
  p_empresa_id uuid,
  p_chave_pix text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_chave_pix text := btrim(coalesce(p_chave_pix, ''));
begin
  if (select auth.uid()) is null then
    raise exception 'login_obrigatorio' using errcode = 'P0001';
  end if;

  if p_empresa_id is null then
    raise exception 'empresa_obrigatoria' using errcode = 'P0001';
  end if;

  if length(v_chave_pix) < 5 then
    raise exception 'chave_pix_invalida' using errcode = 'P0001';
  end if;

  if app_private.usuario_admin_empresa(p_empresa_id) is not true then
    raise exception 'admin_sem_acesso_empresa' using errcode = 'P0001';
  end if;

  update public.empresas
  set chave_pix = v_chave_pix
  where id = p_empresa_id;

  if not found then
    raise exception 'empresa_nao_encontrada' using errcode = 'P0001';
  end if;

  return jsonb_build_object('ok', true, 'chave_pix', v_chave_pix);
end;
$$;

revoke execute on function public.atualizar_chave_pix_empresa(uuid, text) from public, anon;
grant execute on function public.atualizar_chave_pix_empresa(uuid, text) to authenticated, service_role;

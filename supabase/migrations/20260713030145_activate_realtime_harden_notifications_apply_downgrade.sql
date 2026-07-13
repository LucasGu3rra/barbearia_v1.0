do $migration$
declare
  v_tabela text;
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    execute 'create publication supabase_realtime';
  end if;

  foreach v_tabela in array array[
    'clientes',
    'assinaturas',
    'agendamentos',
    'historico_cortes',
    'configuracoes'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_tabela
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_tabela
      );
    end if;
  end loop;
end;
$migration$;

create table if not exists public.agendamento_notificacao_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  agendamento_id uuid not null references public.agendamentos(id) on delete cascade,
  evento text not null check (evento in ('criado', 'cancelado')),
  created_at timestamptz not null default now(),
  processando_em timestamptz,
  processado_em timestamptz,
  tentativas integer not null default 0 check (tentativas >= 0),
  ultimo_erro text,
  unique (agendamento_id, evento)
);

alter table public.agendamento_notificacao_eventos enable row level security;

revoke all on table public.agendamento_notificacao_eventos from public, anon, authenticated;
grant select, insert, update, delete on table public.agendamento_notificacao_eventos to service_role;

create index if not exists agendamento_notificacao_eventos_pendentes_idx
  on public.agendamento_notificacao_eventos (created_at, agendamento_id)
  where processado_em is null;

alter table public.notificacoes
  add column if not exists evento_agendamento_id uuid
  references public.agendamento_notificacao_eventos(id) on delete set null;

create unique index if not exists notificacoes_evento_agendamento_usuario_uidx
  on public.notificacoes (evento_agendamento_id, user_id);

create or replace function app_private.registrar_evento_notificacao_agendamento()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'app_private', 'pg_temp'
as $function$
declare
  v_evento text;
begin
  if tg_op = 'INSERT'
     and coalesce(new.status, 'agendado') in ('agendado', 'confirmado', 'pendente') then
    v_evento := 'criado';
  elsif tg_op = 'UPDATE'
        and coalesce(new.status, '') in ('cancelado', 'cancelada')
        and coalesce(old.status, '') not in ('cancelado', 'cancelada') then
    v_evento := 'cancelado';
  else
    return new;
  end if;

  insert into public.agendamento_notificacao_eventos (
    empresa_id,
    agendamento_id,
    evento
  ) values (
    new.empresa_id,
    new.id,
    v_evento
  )
  on conflict (agendamento_id, evento) do nothing;

  return new;
end;
$function$;

revoke execute on function app_private.registrar_evento_notificacao_agendamento()
  from public, anon, authenticated;

drop trigger if exists trg_registrar_evento_notificacao_agendamento
  on public.agendamentos;

create trigger trg_registrar_evento_notificacao_agendamento
after insert or update of status on public.agendamentos
for each row
execute function app_private.registrar_evento_notificacao_agendamento();

create or replace function public.reivindicar_evento_notificacao_agendamento(
  p_evento_id uuid
)
returns public.agendamento_notificacao_eventos
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_evento public.agendamento_notificacao_eventos;
begin
  if p_evento_id is null then
    return null;
  end if;

  update public.agendamento_notificacao_eventos e
  set processando_em = now(),
      tentativas = e.tentativas + 1,
      ultimo_erro = null
  where e.id = p_evento_id
    and e.processado_em is null
    and (
      e.processando_em is null
      or e.processando_em < now() - interval '5 minutes'
    )
  returning * into v_evento;

  return v_evento;
end;
$function$;

revoke execute on function public.reivindicar_evento_notificacao_agendamento(uuid)
  from public, anon, authenticated;
grant execute on function public.reivindicar_evento_notificacao_agendamento(uuid)
  to service_role;

create or replace function app_private.solicitar_plano_cliente(
  p_empresa_id uuid,
  p_plano_slug text
)
returns public.assinaturas
language plpgsql
security definer
set search_path to 'public', 'app_private'
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

  if not app_private.usuario_cliente_empresa(p_empresa_id) then
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

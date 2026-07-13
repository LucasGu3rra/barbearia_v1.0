-- Harden the multi-tenant scheduling and plan flows without rewriting legacy history.

create unique index if not exists assinaturas_empresa_cliente_unique
  on public.assinaturas (empresa_id, cliente_id)
  where cliente_id is not null;

alter table public.assinaturas
  add column if not exists solicitacao_plano_slug text,
  add column if not exists solicitacao_plano_nome text,
  add column if not exists solicitacao_plano_preco numeric,
  add column if not exists solicitacao_tipo text,
  add column if not exists solicitacao_forma_pagamento text,
  add column if not exists solicitacao_em timestamptz;

alter table public.assinaturas
  drop constraint if exists assinaturas_solicitacao_tipo_valida;
alter table public.assinaturas
  add constraint assinaturas_solicitacao_tipo_valida
  check (solicitacao_tipo is null or solicitacao_tipo in ('adesao', 'reativacao', 'renovacao', 'upgrade'));

alter table public.assinaturas
  drop constraint if exists assinaturas_solicitacao_forma_valida;
alter table public.assinaturas
  add constraint assinaturas_solicitacao_forma_valida
  check (
    solicitacao_forma_pagamento is null
    or solicitacao_forma_pagamento in ('pix', 'presencial', 'nao_informado')
  );

create table if not exists public.assinatura_ciclos (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references public.assinaturas(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  plano_id uuid references public.planos(id) on delete set null,
  plano_slug text not null,
  plano_nome text not null,
  limite integer not null default 0,
  ilimitado boolean not null default false,
  duracao_minutos integer not null default 30,
  preco numeric not null default 0,
  iniciado_em timestamptz not null,
  vencimento_em timestamptz not null,
  encerrado_em timestamptz,
  origem text not null default 'ativacao',
  created_at timestamptz not null default now(),
  constraint assinatura_ciclos_periodo_valido check (vencimento_em > iniciado_em),
  constraint assinatura_ciclos_origem_valida check (origem in ('ativacao', 'renovacao', 'legado')),
  constraint assinatura_ciclos_assinatura_inicio_unique unique (assinatura_id, iniciado_em)
);

create index if not exists assinatura_ciclos_empresa_cliente_periodo_idx
  on public.assinatura_ciclos (empresa_id, cliente_id, iniciado_em desc, vencimento_em desc);

alter table public.agendamentos
  add column if not exists assinatura_id uuid references public.assinaturas(id) on delete set null,
  add column if not exists assinatura_ciclo_id uuid references public.assinatura_ciclos(id) on delete set null;

alter table public.historico_cortes
  add column if not exists assinatura_id uuid references public.assinaturas(id) on delete set null,
  add column if not exists assinatura_ciclo_id uuid references public.assinatura_ciclos(id) on delete set null;

create index if not exists agendamentos_assinatura_ciclo_idx
  on public.agendamentos (assinatura_ciclo_id)
  where assinatura_ciclo_id is not null;

create index if not exists historico_cortes_assinatura_ciclo_idx
  on public.historico_cortes (assinatura_ciclo_id)
  where assinatura_ciclo_id is not null;

alter table public.assinatura_ciclos enable row level security;

drop policy if exists "Clientes e admins leem ciclos da empresa" on public.assinatura_ciclos;
create policy "Clientes e admins leem ciclos da empresa"
on public.assinatura_ciclos
for select
to authenticated
using (
  (
    cliente_id = (select auth.uid())
    and app_private.usuario_cliente_empresa(empresa_id)
  )
  or app_private.usuario_admin_empresa(empresa_id)
);

revoke all on table public.assinatura_ciclos from anon;
revoke insert, update, delete on table public.assinatura_ciclos from authenticated;
grant select on table public.assinatura_ciclos to authenticated, service_role;
grant insert, update, delete on table public.assinatura_ciclos to service_role;

-- Preserve the current known cycle. Older cycles whose dates were overwritten are left untouched.
insert into public.assinatura_ciclos (
  assinatura_id,
  empresa_id,
  cliente_id,
  plano_id,
  plano_slug,
  plano_nome,
  limite,
  ilimitado,
  duracao_minutos,
  preco,
  iniciado_em,
  vencimento_em,
  origem
)
select
  a.id,
  a.empresa_id,
  a.cliente_id,
  p.id,
  p.slug,
  p.nome,
  greatest(coalesce(p.limite, 0), 0),
  coalesce(p.ilimitado, false),
  greatest(coalesce(p.duracao_minutos, 30), 1),
  coalesce(p.preco, 0),
  coalesce(a.ativada_em, a.data_vencimento - interval '30 days'),
  a.data_vencimento,
  'legado'
from public.assinaturas a
join public.planos p
  on p.empresa_id = a.empresa_id
 and p.slug = a.plano_escolhido
where a.cliente_id is not null
  and a.data_vencimento is not null
  and coalesce(a.ativada_em, a.data_vencimento - interval '30 days') < a.data_vencimento
on conflict (assinatura_id, iniciado_em) do nothing;

update public.agendamentos ag
set assinatura_id = c.assinatura_id,
    assinatura_ciclo_id = c.id
from public.assinatura_ciclos c
where ag.assinatura_ciclo_id is null
  and ag.tipo_cliente = 'assinante'
  and ag.empresa_id = c.empresa_id
  and ag.cliente_id = c.cliente_id
  and ag.data_hora >= c.iniciado_em
  and ag.data_hora <= c.vencimento_em;

update public.historico_cortes h
set assinatura_id = c.assinatura_id,
    assinatura_ciclo_id = c.id
from public.assinatura_ciclos c
where h.assinatura_ciclo_id is null
  and (h.plano_slug is not null or h.origem = 'plano_confirmacao')
  and h.empresa_id = c.empresa_id
  and h.cliente_id = c.cliente_id
  and h.created_at >= c.iniciado_em
  and h.created_at <= c.vencimento_em;

create or replace function app_private.obter_ou_criar_ciclo_assinatura(
  p_assinatura_id uuid,
  p_momento timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_assinatura public.assinaturas;
  v_plano public.planos;
  v_ciclo_id uuid;
  v_inicio timestamptz;
begin
  select * into v_assinatura
  from public.assinaturas a
  where a.id = p_assinatura_id
  for update;

  if v_assinatura.id is null or v_assinatura.cliente_id is null then
    raise exception 'assinatura_nao_encontrada' using errcode = 'P0001';
  end if;

  select c.id into v_ciclo_id
  from public.assinatura_ciclos c
  where c.assinatura_id = v_assinatura.id
    and p_momento >= c.iniciado_em
    and p_momento <= c.vencimento_em
  order by c.iniciado_em desc
  limit 1;

  if v_ciclo_id is not null then
    return v_ciclo_id;
  end if;

  if v_assinatura.data_vencimento is null then
    raise exception 'ciclo_assinatura_indisponivel' using errcode = 'P0001';
  end if;

  v_inicio := coalesce(
    v_assinatura.ativada_em,
    v_assinatura.data_vencimento - interval '30 days'
  );

  if p_momento < v_inicio or p_momento > v_assinatura.data_vencimento then
    raise exception 'ciclo_assinatura_indisponivel' using errcode = 'P0001';
  end if;

  select * into v_plano
  from public.planos p
  where p.empresa_id = v_assinatura.empresa_id
    and p.slug = v_assinatura.plano_escolhido
  order by (p.deleted_at is null) desc, p.created_at desc
  limit 1;

  if v_plano.id is null then
    raise exception 'plano_indisponivel' using errcode = 'P0001';
  end if;

  insert into public.assinatura_ciclos (
    assinatura_id,
    empresa_id,
    cliente_id,
    plano_id,
    plano_slug,
    plano_nome,
    limite,
    ilimitado,
    duracao_minutos,
    preco,
    iniciado_em,
    vencimento_em,
    origem
  ) values (
    v_assinatura.id,
    v_assinatura.empresa_id,
    v_assinatura.cliente_id,
    v_plano.id,
    v_plano.slug,
    v_plano.nome,
    greatest(coalesce(v_plano.limite, 0), 0),
    coalesce(v_plano.ilimitado, false),
    greatest(coalesce(v_plano.duracao_minutos, 30), 1),
    coalesce(v_plano.preco, 0),
    v_inicio,
    v_assinatura.data_vencimento,
    'ativacao'
  )
  on conflict (assinatura_id, iniciado_em)
  do update set vencimento_em = excluded.vencimento_em
  returning id into v_ciclo_id;

  return v_ciclo_id;
end;
$function$;

create or replace function app_private.contar_usos_plano_ciclo(
  p_empresa_id uuid,
  p_cliente_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz,
  p_ciclo_id uuid default null,
  p_excluir_agendamento_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (
      select count(*)::integer
      from public.historico_cortes h
      where h.empresa_id = p_empresa_id
        and h.cliente_id = p_cliente_id
        and coalesce(h.status, 'feito') not in ('cancelado', 'cancelada')
        and (h.plano_slug is not null or h.origem = 'plano_confirmacao')
        and (
          (p_ciclo_id is not null and h.assinatura_ciclo_id = p_ciclo_id)
          or (
            h.assinatura_ciclo_id is null
            and h.created_at >= p_inicio
            and h.created_at <= p_fim
          )
        )
    )
    +
    (
      select count(*)::integer
      from public.agendamentos a
      where a.empresa_id = p_empresa_id
        and a.cliente_id = p_cliente_id
        and a.tipo_cliente = 'assinante'
        and a.id is distinct from p_excluir_agendamento_id
        and coalesce(a.status, 'agendado') not in ('cancelado', 'cancelada')
        and (
          (p_ciclo_id is not null and a.assinatura_ciclo_id = p_ciclo_id)
          or (
            a.assinatura_ciclo_id is null
            and a.data_hora >= p_inicio
            and a.data_hora <= p_fim
          )
        )
    );
$function$;

revoke execute on function app_private.obter_ou_criar_ciclo_assinatura(uuid, timestamptz)
  from public, anon, authenticated;
revoke execute on function app_private.contar_usos_plano_ciclo(uuid, uuid, timestamptz, timestamptz, uuid, uuid)
  from public, anon, authenticated;
grant execute on function app_private.obter_ou_criar_ciclo_assinatura(uuid, timestamptz)
  to service_role;
grant execute on function app_private.contar_usos_plano_ciclo(uuid, uuid, timestamptz, timestamptz, uuid, uuid)
  to service_role;

create or replace function public.validar_conflito_agendamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_inicio_novo timestamptz;
  v_fim_novo timestamptz;
  v_duracao_nova integer;
  v_plano public.planos;
  v_servico public.servicos;
  v_horario public.horarios_funcionamento;
  v_hora_local time;
  v_dia_local integer;
  v_insercao_cliente boolean := false;
begin
  v_insercao_cliente := tg_op = 'INSERT'
    and auth.uid() is not null
    and new.cliente_id = auth.uid()
    and app_private.usuario_cliente_empresa(new.empresa_id);

  if v_insercao_cliente then
    new.status := 'agendado';
  end if;

  if not exists (
    select 1
    from public.empresas e
    where e.id = new.empresa_id
      and e.ativa = true
  ) then
    raise exception 'empresa_indisponivel' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.clientes c
    where c.id = new.cliente_id
      and c.empresa_id = new.empresa_id
  ) then
    raise exception 'cliente_empresa_invalido' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.filiais f
    where f.id = new.filial_id
      and f.empresa_id = new.empresa_id
      and f.ativa = true
  ) then
    raise exception 'filial_indisponivel' using errcode = 'P0001';
  end if;

  if new.barbeiro_id is not null and not exists (
    select 1
    from public.barbeiros b
    where b.id = new.barbeiro_id
      and b.empresa_id = new.empresa_id
      and b.filial_id = new.filial_id
      and b.ativo = true
  ) then
    raise exception 'barbeiro_indisponivel' using errcode = 'P0001';
  end if;

  if coalesce(new.status, 'agendado') in ('cancelado', 'cancelada', 'finalizado', 'concluido') then
    return new;
  end if;

  if v_insercao_cliente and new.data_hora <= now() then
    raise exception 'horario_agendamento_invalido' using errcode = 'P0001';
  end if;

  if new.tipo_cliente = 'assinante' then
    select p.* into v_plano
    from public.planos p
    where p.id = new.plano_id
      and p.empresa_id = new.empresa_id
      and p.ativo = true
      and p.deleted_at is null
    limit 1;

    if v_plano.id is null then
      raise exception 'plano_indisponivel' using errcode = 'P0001';
    end if;

    new.servico_id := null;
    new.tipo_cliente := 'assinante';
    new.duracao_minutos := greatest(coalesce(v_plano.duracao_minutos, 30), 1);
  else
    if new.servico_id is null then
      raise exception 'servico_obrigatorio' using errcode = 'P0001';
    end if;

    select s.* into v_servico
    from public.servicos s
    where s.id = new.servico_id
      and s.empresa_id = new.empresa_id
      and s.ativo = true
      and s.deleted_at is null
    limit 1;

    if v_servico.id is null then
      raise exception 'servico_indisponivel' using errcode = 'P0001';
    end if;

    new.plano_id := null;
    new.assinatura_id := null;
    new.assinatura_ciclo_id := null;
    new.tipo_cliente := 'avulso';
    new.duracao_minutos := greatest(coalesce(v_servico.duracao_minutos, 30), 1);
  end if;

  v_hora_local := (new.data_hora at time zone 'America/Sao_Paulo')::time;
  v_dia_local := extract(dow from new.data_hora at time zone 'America/Sao_Paulo')::integer;

  select h.* into v_horario
  from public.horarios_funcionamento h
  where h.empresa_id = new.empresa_id
    and h.filial_id = new.filial_id
    and h.dia_semana = v_dia_local
  limit 1;

  if v_horario.id is null
     or coalesce(v_horario.aberto, false) is not true
     or v_horario.horario_inicio is null
     or v_horario.horario_fim is null
     or v_hora_local < v_horario.horario_inicio
     or v_hora_local >= v_horario.horario_fim
     or (
       v_horario.intervalo_inicio is not null
       and v_horario.intervalo_fim is not null
       and v_hora_local >= v_horario.intervalo_inicio
       and v_hora_local < v_horario.intervalo_fim
     )
  then
    raise exception 'horario_fora_funcionamento' using errcode = 'P0001';
  end if;

  v_duracao_nova := new.duracao_minutos;
  v_inicio_novo := new.data_hora;
  v_fim_novo := new.data_hora + make_interval(mins => v_duracao_nova);

  if new.tipo_cliente = 'avulso' and exists (
    select 1
    from public.agendamentos a
    where a.empresa_id = new.empresa_id
      and a.cliente_id = new.cliente_id
      and coalesce(a.tipo_cliente, 'avulso') = 'avulso'
      and coalesce(a.status, 'agendado') not in ('cancelado', 'cancelada', 'finalizado', 'concluido')
      and a.id is distinct from new.id
      and (a.data_hora at time zone 'America/Sao_Paulo')::date =
          (new.data_hora at time zone 'America/Sao_Paulo')::date
  ) then
    raise exception 'cliente_agendamento_dia_conflito' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.agendamentos a
    where a.empresa_id = new.empresa_id
      and a.cliente_id = new.cliente_id
      and coalesce(a.status, 'agendado') not in ('cancelado', 'cancelada', 'finalizado', 'concluido')
      and a.id is distinct from new.id
      and a.data_hora < v_fim_novo
      and (a.data_hora + make_interval(mins => a.duracao_minutos)) > v_inicio_novo
  ) then
    raise exception 'cliente_agendamento_conflito' using errcode = '23505';
  end if;

  if new.barbeiro_id is not null and exists (
    select 1
    from public.agendamentos a
    where a.empresa_id = new.empresa_id
      and a.barbeiro_id = new.barbeiro_id
      and coalesce(a.status, 'agendado') not in ('cancelado', 'cancelada', 'finalizado', 'concluido')
      and a.id is distinct from new.id
      and a.data_hora < v_fim_novo
      and (a.data_hora + make_interval(mins => a.duracao_minutos)) > v_inicio_novo
  ) then
    raise exception 'barbeiro_agendamento_conflito' using errcode = '23505';
  end if;

  return new;
end;
$function$;

create or replace function public.validar_agendamento_plano_diario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_conflito uuid;
  v_assinatura public.assinaturas;
  v_plano public.planos;
  v_usos_ciclo integer := 0;
  v_inicio_ciclo timestamptz;
  v_ciclo_id uuid;
begin
  if coalesce(new.status, 'agendado') in ('cancelado', 'cancelada') then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and coalesce(new.status, 'agendado') in ('finalizado', 'concluido')
    and coalesce(old.status, 'agendado') not in ('cancelado', 'cancelada')
    and old.cliente_id is not distinct from new.cliente_id
    and old.empresa_id is not distinct from new.empresa_id
    and old.tipo_cliente is not distinct from new.tipo_cliente
    and old.data_hora is not distinct from new.data_hora
  then
    return new;
  end if;

  if new.tipo_cliente <> 'assinante' then
    new.assinatura_id := null;
    new.assinatura_ciclo_id := null;
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    new.empresa_id::text || ':' || new.cliente_id::text || ':' ||
    ((new.data_hora at time zone 'America/Sao_Paulo')::date)::text || ':plano-dia',
    0
  ));

  select a.* into v_assinatura
  from public.assinaturas a
  where a.empresa_id = new.empresa_id
    and a.cliente_id = new.cliente_id
    and a.status = 'ativa'
    and a.plano_escolhido is not null
    and a.data_vencimento >= new.data_hora
    and coalesce(a.ativada_em, a.data_vencimento - interval '30 days', a.created_at) <= new.data_hora
  limit 1
  for update;

  if v_assinatura.id is null then
    raise exception 'plano_ativo_nao_encontrado' using errcode = 'P0001';
  end if;

  select p.* into v_plano
  from public.planos p
  where p.id = new.plano_id
    and p.empresa_id = new.empresa_id
    and p.slug = v_assinatura.plano_escolhido
    and p.ativo = true
    and p.deleted_at is null
  limit 1;

  if v_plano.id is null then
    raise exception 'plano_indisponivel' using errcode = 'P0001';
  end if;

  v_inicio_ciclo := coalesce(
    v_assinatura.ativada_em,
    v_assinatura.data_vencimento - interval '30 days',
    v_assinatura.created_at
  );
  v_ciclo_id := app_private.obter_ou_criar_ciclo_assinatura(v_assinatura.id, new.data_hora);
  new.assinatura_id := v_assinatura.id;
  new.assinatura_ciclo_id := v_ciclo_id;

  select a.id into v_conflito
  from public.agendamentos a
  where a.empresa_id = new.empresa_id
    and a.cliente_id = new.cliente_id
    and a.tipo_cliente = 'assinante'
    and coalesce(a.status, 'agendado') not in ('cancelado', 'cancelada')
    and a.id is distinct from new.id
    and (a.data_hora at time zone 'America/Sao_Paulo')::date =
        (new.data_hora at time zone 'America/Sao_Paulo')::date
  limit 1;

  if v_conflito is not null then
    raise exception 'cliente_plano_agendamento_dia_conflito' using errcode = 'P0001';
  end if;

  select h.id into v_conflito
  from public.historico_cortes h
  where h.empresa_id = new.empresa_id
    and h.cliente_id = new.cliente_id
    and coalesce(h.status, 'feito') not in ('cancelado', 'cancelada')
    and (h.plano_slug is not null or h.origem = 'plano_confirmacao')
    and (h.created_at at time zone 'America/Sao_Paulo')::date =
        (new.data_hora at time zone 'America/Sao_Paulo')::date
  limit 1;

  if v_conflito is not null then
    raise exception 'cliente_plano_agendamento_dia_conflito' using errcode = 'P0001';
  end if;

  if coalesce(v_plano.ilimitado, false) is not true then
    v_usos_ciclo := app_private.contar_usos_plano_ciclo(
      new.empresa_id,
      new.cliente_id,
      v_inicio_ciclo,
      v_assinatura.data_vencimento,
      v_ciclo_id,
      new.id
    );

    if v_usos_ciclo >= greatest(coalesce(v_plano.limite, 0), 0) then
      raise exception 'limite_plano_atingido' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$function$;

revoke execute on function public.validar_conflito_agendamento() from public, anon, authenticated;
revoke execute on function public.validar_agendamento_plano_diario() from public, anon, authenticated;

create or replace function app_private.confirmar_corte_plano(p_empresa_id uuid)
returns public.historico_cortes
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cliente_id uuid := auth.uid();
  v_assinatura public.assinaturas;
  v_plano public.planos;
  v_agendamento_ativo boolean := false;
  v_prazo integer := 120;
  v_usados integer := 0;
  v_usados_dia integer := 0;
  v_inicio_ciclo timestamptz;
  v_ciclo_id uuid;
  v_corte public.historico_cortes;
begin
  if v_cliente_id is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  if app_private.usuario_cliente_empresa(p_empresa_id) is not true then
    raise exception 'cliente_sem_acesso_empresa' using errcode = 'P0001';
  end if;

  select
    coalesce((c.valor ->> 'agendamento_ativo')::boolean, false),
    greatest(coalesce(
      (c.valor ->> 'prazo_cancelamento_minutos')::integer,
      (c.valor ->> 'cancelamento_minutos')::integer,
      120
    ), 0)
  into v_agendamento_ativo, v_prazo
  from public.configuracoes c
  where c.empresa_id = p_empresa_id
    and c.chave = 'fluxo_agendamento'
  limit 1;

  if coalesce(v_agendamento_ativo, false) is true then
    raise exception 'confirmacao_presencial_indisponivel' using errcode = 'P0001';
  end if;

  perform public.expirar_assinaturas_vencidas();
  perform pg_advisory_xact_lock(hashtextextended(
    p_empresa_id::text || ':' || v_cliente_id::text || ':' ||
    ((now() at time zone 'America/Sao_Paulo')::date)::text || ':plano-dia',
    0
  ));

  select a.* into v_assinatura
  from public.assinaturas a
  where a.empresa_id = p_empresa_id
    and a.cliente_id = v_cliente_id
    and a.status = 'ativa'
    and a.plano_escolhido is not null
    and a.data_vencimento >= now()
    and coalesce(a.ativada_em, a.data_vencimento - interval '30 days', a.created_at) <= now()
  limit 1
  for update;

  if v_assinatura.id is null then
    raise exception 'plano_ativo_nao_encontrado' using errcode = 'P0001';
  end if;

  select p.* into v_plano
  from public.planos p
  where p.empresa_id = p_empresa_id
    and p.slug = v_assinatura.plano_escolhido
    and p.ativo = true
    and p.deleted_at is null
  limit 1;

  if v_plano.id is null then
    raise exception 'plano_indisponivel' using errcode = 'P0001';
  end if;

  v_inicio_ciclo := coalesce(
    v_assinatura.ativada_em,
    v_assinatura.data_vencimento - interval '30 days',
    v_assinatura.created_at
  );
  v_ciclo_id := app_private.obter_ou_criar_ciclo_assinatura(v_assinatura.id, now());

  select (
    (
      select count(*)::integer
      from public.historico_cortes h
      where h.empresa_id = p_empresa_id
        and h.cliente_id = v_cliente_id
        and coalesce(h.status, 'feito') not in ('cancelado', 'cancelada')
        and (h.plano_slug is not null or h.origem = 'plano_confirmacao')
        and (h.created_at at time zone 'America/Sao_Paulo')::date =
            (now() at time zone 'America/Sao_Paulo')::date
    )
    +
    (
      select count(*)::integer
      from public.agendamentos a
      where a.empresa_id = p_empresa_id
        and a.cliente_id = v_cliente_id
        and a.tipo_cliente = 'assinante'
        and coalesce(a.status, 'agendado') not in ('cancelado', 'cancelada')
        and (a.data_hora at time zone 'America/Sao_Paulo')::date =
            (now() at time zone 'America/Sao_Paulo')::date
    )
  ) into v_usados_dia;

  if v_usados_dia > 0 then
    raise exception 'cliente_plano_corte_dia_conflito' using errcode = 'P0001';
  end if;

  if coalesce(v_plano.ilimitado, false) is not true then
    v_usados := app_private.contar_usos_plano_ciclo(
      p_empresa_id,
      v_cliente_id,
      v_inicio_ciclo,
      v_assinatura.data_vencimento,
      v_ciclo_id,
      null
    );

    if v_usados >= greatest(coalesce(v_plano.limite, 0), 0) then
      raise exception 'limite_plano_atingido' using errcode = 'P0001';
    end if;
  end if;

  insert into public.historico_cortes (
    empresa_id,
    cliente_id,
    tipo_corte,
    status,
    origem,
    plano_slug,
    cancelavel_ate,
    assinatura_id,
    assinatura_ciclo_id
  ) values (
    p_empresa_id,
    v_cliente_id,
    v_plano.nome,
    'feito',
    'plano_confirmacao',
    v_plano.slug,
    now() + make_interval(mins => coalesce(v_prazo, 120)),
    v_assinatura.id,
    v_ciclo_id
  )
  returning * into v_corte;

  return v_corte;
end;
$function$;

create or replace function public.obter_confirmacao_corte_plano(
  p_empresa_id uuid,
  p_corte_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cliente_id uuid := auth.uid();
  v_corte public.historico_cortes;
  v_ciclo public.assinatura_ciclos;
  v_assinatura public.assinaturas;
  v_plano public.planos;
  v_cliente public.clientes;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_usos integer := 0;
begin
  if v_cliente_id is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  if app_private.usuario_cliente_empresa(p_empresa_id) is not true then
    raise exception 'cliente_sem_acesso_empresa' using errcode = 'P0001';
  end if;

  select h.* into v_corte
  from public.historico_cortes h
  where h.id = p_corte_id
    and h.empresa_id = p_empresa_id
    and h.cliente_id = v_cliente_id
    and h.origem = 'plano_confirmacao'
    and coalesce(h.status, 'feito') not in ('cancelado', 'cancelada')
    and now() <= coalesce(h.cancelavel_ate, h.created_at + interval '15 minutes')
  limit 1;

  if v_corte.id is null then
    raise exception 'confirmacao_corte_invalida' using errcode = 'P0001';
  end if;

  if v_corte.assinatura_ciclo_id is not null then
    select * into v_ciclo
    from public.assinatura_ciclos c
    where c.id = v_corte.assinatura_ciclo_id
      and c.empresa_id = p_empresa_id
      and c.cliente_id = v_cliente_id;
  end if;

  if v_corte.assinatura_id is not null then
    select * into v_assinatura
    from public.assinaturas a
    where a.id = v_corte.assinatura_id
      and a.empresa_id = p_empresa_id
      and a.cliente_id = v_cliente_id;
  else
    select * into v_assinatura
    from public.assinaturas a
    where a.empresa_id = p_empresa_id
      and a.cliente_id = v_cliente_id
    limit 1;
  end if;

  select * into v_plano
  from public.planos p
  where p.empresa_id = p_empresa_id
    and p.slug = coalesce(v_ciclo.plano_slug, v_corte.plano_slug, v_assinatura.plano_escolhido)
  order by (p.deleted_at is null) desc, p.created_at desc
  limit 1;

  select * into v_cliente
  from public.clientes c
  where c.id = v_cliente_id
    and c.empresa_id = p_empresa_id;

  v_inicio := coalesce(
    v_ciclo.iniciado_em,
    v_assinatura.ativada_em,
    v_assinatura.data_vencimento - interval '30 days'
  );
  v_fim := coalesce(v_ciclo.vencimento_em, v_assinatura.data_vencimento);

  if v_inicio is not null and v_fim is not null then
    v_usos := app_private.contar_usos_plano_ciclo(
      p_empresa_id,
      v_cliente_id,
      v_inicio,
      v_fim,
      v_corte.assinatura_ciclo_id,
      null
    );
  end if;

  return jsonb_build_object(
    'corte_id', v_corte.id,
    'nome', coalesce(v_cliente.nome, 'Cliente'),
    'cortes', v_usos,
    'ilimitado', coalesce(v_ciclo.ilimitado, v_plano.ilimitado, false),
    'limite_total', greatest(coalesce(v_ciclo.limite, v_plano.limite, 0), 0),
    'plano_nome', coalesce(v_ciclo.plano_nome, v_plano.nome, v_corte.tipo_corte, 'Plano'),
    'vencimento', v_fim,
    'tipo_corte', coalesce(v_corte.tipo_corte, v_plano.nome, 'Plano'),
    'cancelavel_ate', v_corte.cancelavel_ate
  );
end;
$function$;

create or replace function public.criar_agendamento_cliente(
  p_empresa_id uuid,
  p_filial_id uuid,
  p_recurso_id uuid,
  p_barbeiro_id uuid,
  p_data_hora timestamptz,
  p_tipo_cliente text
)
returns public.agendamentos
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cliente_id uuid := auth.uid();
  v_tipo text := lower(btrim(coalesce(p_tipo_cliente, '')));
  v_agendamento_ativo boolean := false;
  v_servico public.servicos;
  v_plano public.planos;
  v_assinatura public.assinaturas;
  v_agendamento public.agendamentos;
  v_duracao integer;
begin
  if v_cliente_id is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  if app_private.usuario_cliente_empresa(p_empresa_id) is not true then
    raise exception 'cliente_sem_acesso_empresa' using errcode = 'P0001';
  end if;

  if v_tipo not in ('avulso', 'assinante') then
    raise exception 'tipo_agendamento_invalido' using errcode = 'P0001';
  end if;

  if p_data_hora is null or p_data_hora <= now() then
    raise exception 'horario_agendamento_invalido' using errcode = 'P0001';
  end if;

  select coalesce((c.valor ->> 'agendamento_ativo')::boolean, false)
  into v_agendamento_ativo
  from public.configuracoes c
  where c.empresa_id = p_empresa_id
    and c.chave = 'fluxo_agendamento'
  limit 1;

  if coalesce(v_agendamento_ativo, false) is not true then
    raise exception 'agendamento_online_desativado' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.filiais f
    where f.id = p_filial_id
      and f.empresa_id = p_empresa_id
      and f.ativa = true
  ) then
    raise exception 'filial_indisponivel' using errcode = 'P0001';
  end if;

  if p_barbeiro_id is null or not exists (
    select 1 from public.barbeiros b
    where b.id = p_barbeiro_id
      and b.empresa_id = p_empresa_id
      and b.filial_id = p_filial_id
      and b.ativo = true
  ) then
    raise exception 'barbeiro_indisponivel' using errcode = 'P0001';
  end if;

  if v_tipo = 'assinante' then
    select a.* into v_assinatura
    from public.assinaturas a
    where a.empresa_id = p_empresa_id
      and a.cliente_id = v_cliente_id
      and a.status = 'ativa'
      and a.data_vencimento >= p_data_hora
      and coalesce(a.ativada_em, a.data_vencimento - interval '30 days', a.created_at) <= p_data_hora
    limit 1
    for update;

    if v_assinatura.id is null then
      raise exception 'plano_ativo_nao_encontrado' using errcode = 'P0001';
    end if;

    select p.* into v_plano
    from public.planos p
    where p.id = p_recurso_id
      and p.empresa_id = p_empresa_id
      and p.slug = v_assinatura.plano_escolhido
      and p.ativo = true
      and p.deleted_at is null
    limit 1;

    if v_plano.id is null then
      raise exception 'plano_indisponivel' using errcode = 'P0001';
    end if;
    v_duracao := greatest(coalesce(v_plano.duracao_minutos, 30), 1);
  else
    select s.* into v_servico
    from public.servicos s
    where s.id = p_recurso_id
      and s.empresa_id = p_empresa_id
      and s.ativo = true
      and s.deleted_at is null
    limit 1;

    if v_servico.id is null then
      raise exception 'servico_indisponivel' using errcode = 'P0001';
    end if;
    v_duracao := greatest(coalesce(v_servico.duracao_minutos, 30), 1);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_empresa_id::text || ':' || p_barbeiro_id::text || ':' ||
    ((p_data_hora at time zone 'America/Sao_Paulo')::date)::text || ':agenda',
    0
  ));

  insert into public.agendamentos (
    cliente_id,
    empresa_id,
    filial_id,
    servico_id,
    plano_id,
    barbeiro_id,
    data_hora,
    tipo_cliente,
    duracao_minutos,
    status,
    assinatura_id
  ) values (
    v_cliente_id,
    p_empresa_id,
    p_filial_id,
    case when v_tipo = 'avulso' then v_servico.id else null end,
    case when v_tipo = 'assinante' then v_plano.id else null end,
    p_barbeiro_id,
    p_data_hora,
    v_tipo,
    v_duracao,
    'agendado',
    case when v_tipo = 'assinante' then v_assinatura.id else null end
  )
  returning * into v_agendamento;

  return v_agendamento;
end;
$function$;

revoke execute on function app_private.confirmar_corte_plano(uuid) from public, anon;
grant execute on function app_private.confirmar_corte_plano(uuid) to authenticated, service_role;
revoke execute on function public.obter_confirmacao_corte_plano(uuid, uuid) from public, anon;
grant execute on function public.obter_confirmacao_corte_plano(uuid, uuid) to authenticated, service_role;
revoke execute on function public.criar_agendamento_cliente(uuid, uuid, uuid, uuid, timestamptz, text) from public, anon;
grant execute on function public.criar_agendamento_cliente(uuid, uuid, uuid, uuid, timestamptz, text) to authenticated, service_role;

create or replace function public.plano_popular_empresa(p_empresa_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  if app_private.usuario_pertence_empresa(p_empresa_id) is not true then
    raise exception 'acesso_negado' using errcode = 'P0001';
  end if;

  select p.slug into v_slug
  from public.planos p
  left join public.assinaturas a
    on a.empresa_id = p.empresa_id
   and a.plano_escolhido = p.slug
   and a.status = 'ativa'
   and a.data_vencimento >= now()
  where p.empresa_id = p_empresa_id
    and p.ativo = true
    and p.deleted_at is null
  group by p.id, p.slug, p.preco, p.created_at
  order by count(a.id) desc, p.preco asc, p.created_at asc
  limit 1;

  return v_slug;
end;
$function$;

revoke execute on function public.plano_popular_empresa(uuid) from public, anon;
grant execute on function public.plano_popular_empresa(uuid) to authenticated, service_role;

create or replace function app_private.solicitar_pagamento_plano_cliente(
  p_empresa_id uuid,
  p_plano_slug text,
  p_forma_pagamento text
)
returns public.assinaturas
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cliente_id uuid := auth.uid();
  v_forma text := lower(btrim(coalesce(p_forma_pagamento, 'nao_informado')));
  v_plano public.planos;
  v_plano_atual public.planos;
  v_assinatura public.assinaturas;
  v_inicio timestamptz;
  v_ciclo_id uuid;
  v_usos integer := 0;
  v_tipo_solicitacao text;
begin
  if v_cliente_id is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  if app_private.usuario_cliente_empresa(p_empresa_id) is not true then
    raise exception 'cliente_sem_acesso_empresa' using errcode = 'P0001';
  end if;

  if v_forma not in ('pix', 'presencial', 'nao_informado') then
    raise exception 'forma_pagamento_invalida' using errcode = 'P0001';
  end if;

  select * into v_plano
  from public.planos p
  where p.empresa_id = p_empresa_id
    and p.slug = btrim(p_plano_slug)
    and p.ativo = true
    and p.deleted_at is null
  limit 1;

  if v_plano.id is null then
    raise exception 'plano_indisponivel' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_empresa_id::text || ':' || v_cliente_id::text || ':assinatura',
    0
  ));

  select * into v_assinatura
  from public.assinaturas a
  where a.empresa_id = p_empresa_id
    and a.cliente_id = v_cliente_id
  limit 1
  for update;

  if v_assinatura.id is not null and v_assinatura.solicitacao_plano_slug is not null then
    if v_assinatura.solicitacao_plano_slug = v_plano.slug then
      return v_assinatura;
    end if;
    raise exception 'solicitacao_plano_pendente' using errcode = 'P0001';
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
      upgrade_pendente,
      solicitacao_plano_slug,
      solicitacao_plano_nome,
      solicitacao_plano_preco,
      solicitacao_tipo,
      solicitacao_forma_pagamento,
      solicitacao_em
    ) values (
      p_empresa_id,
      v_cliente_id,
      v_plano.slug,
      'pendente',
      null,
      null,
      null,
      null,
      v_plano.slug,
      v_plano.nome,
      v_plano.preco,
      'adesao',
      v_forma,
      now()
    )
    returning * into v_assinatura;

    return v_assinatura;
  end if;

  if v_assinatura.status = 'pendente' then
    if v_assinatura.plano_escolhido is distinct from v_plano.slug then
      raise exception 'solicitacao_plano_pendente' using errcode = 'P0001';
    end if;

    update public.assinaturas a
    set solicitacao_plano_slug = v_plano.slug,
        solicitacao_plano_nome = v_plano.nome,
        solicitacao_plano_preco = v_plano.preco,
        solicitacao_tipo = coalesce(a.solicitacao_tipo, 'adesao'),
        solicitacao_forma_pagamento = v_forma,
        solicitacao_em = coalesce(a.solicitacao_em, now())
    where a.id = v_assinatura.id
    returning * into v_assinatura;

    return v_assinatura;
  end if;

  if v_assinatura.status = 'ativa'
     and v_assinatura.data_vencimento is not null
     and v_assinatura.data_vencimento >= now()
  then
    if v_assinatura.plano_escolhido is distinct from v_plano.slug then
      raise exception 'plano_ativo_ja_existente' using errcode = 'P0001';
    end if;

    if coalesce(v_plano.ilimitado, false) is true then
      raise exception 'plano_ainda_possui_usos' using errcode = 'P0001';
    end if;

    v_inicio := coalesce(
      v_assinatura.ativada_em,
      v_assinatura.data_vencimento - interval '30 days',
      v_assinatura.created_at
    );
    v_ciclo_id := app_private.obter_ou_criar_ciclo_assinatura(v_assinatura.id, now());
    v_usos := app_private.contar_usos_plano_ciclo(
      p_empresa_id,
      v_cliente_id,
      v_inicio,
      v_assinatura.data_vencimento,
      v_ciclo_id,
      null
    );

    if v_usos < greatest(coalesce(v_plano.limite, 0), 0) then
      raise exception 'plano_ainda_possui_usos' using errcode = 'P0001';
    end if;

    update public.assinaturas a
    set solicitacao_plano_slug = v_plano.slug,
        solicitacao_plano_nome = v_plano.nome,
        solicitacao_plano_preco = v_plano.preco,
        solicitacao_tipo = 'renovacao',
        solicitacao_forma_pagamento = v_forma,
        solicitacao_em = now()
    where a.id = v_assinatura.id
    returning * into v_assinatura;

    return v_assinatura;
  end if;

  select * into v_plano_atual
  from public.planos p
  where p.empresa_id = p_empresa_id
    and p.slug = v_assinatura.plano_escolhido
  order by (p.deleted_at is null) desc, p.created_at desc
  limit 1;

  v_tipo_solicitacao := case
    when v_plano_atual.id is not null and v_plano_atual.slug = v_plano.slug then 'renovacao'
    else 'reativacao'
  end;

  update public.assinaturas a
  set plano_escolhido = v_plano.slug,
      status = 'pendente',
      ativada_em = null,
      data_vencimento = null,
      proximo_plano = null,
      upgrade_pendente = null,
      solicitacao_plano_slug = v_plano.slug,
      solicitacao_plano_nome = v_plano.nome,
      solicitacao_plano_preco = v_plano.preco,
      solicitacao_tipo = v_tipo_solicitacao,
      solicitacao_forma_pagamento = v_forma,
      solicitacao_em = now()
  where a.id = v_assinatura.id
  returning * into v_assinatura;

  return v_assinatura;
end;
$function$;

create or replace function public.solicitar_pagamento_plano_cliente(
  p_empresa_id uuid,
  p_plano_slug text,
  p_forma_pagamento text
)
returns public.assinaturas
language sql
set search_path to 'public', 'app_private', 'pg_temp'
as $function$
  select *
  from app_private.solicitar_pagamento_plano_cliente(
    p_empresa_id,
    p_plano_slug,
    p_forma_pagamento
  );
$function$;

-- Compatibility for already installed/cached PWA versions.
create or replace function app_private.solicitar_plano_cliente(
  p_empresa_id uuid,
  p_plano_slug text
)
returns public.assinaturas
language sql
security definer
set search_path = ''
as $function$
  select *
  from app_private.solicitar_pagamento_plano_cliente(
    p_empresa_id,
    p_plano_slug,
    'nao_informado'
  );
$function$;

revoke execute on function app_private.solicitar_pagamento_plano_cliente(uuid, text, text)
  from public, anon;
grant execute on function app_private.solicitar_pagamento_plano_cliente(uuid, text, text)
  to authenticated, service_role;
revoke execute on function public.solicitar_pagamento_plano_cliente(uuid, text, text)
  from public, anon;
grant execute on function public.solicitar_pagamento_plano_cliente(uuid, text, text)
  to authenticated, service_role;
revoke execute on function app_private.solicitar_plano_cliente(uuid, text)
  from public, anon;
grant execute on function app_private.solicitar_plano_cliente(uuid, text)
  to authenticated, service_role;

create or replace function app_private.solicitar_mudanca_plano_cliente(
  p_empresa_id uuid,
  p_plano_slug text
)
returns public.assinaturas
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cliente_id uuid := auth.uid();
  v_assinatura public.assinaturas;
  v_plano_atual public.planos;
  v_plano_novo public.planos;
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
    and a.status = 'ativa'
    and a.plano_escolhido is not null
    and a.data_vencimento >= now()
  limit 1
  for update;

  if v_assinatura.id is null then
    raise exception 'plano_ativo_nao_encontrado' using errcode = 'P0001';
  end if;

  if v_assinatura.solicitacao_plano_slug is not null then
    raise exception 'solicitacao_plano_pendente' using errcode = 'P0001';
  end if;

  select * into v_plano_atual
  from public.planos p
  where p.empresa_id = p_empresa_id
    and p.slug = v_assinatura.plano_escolhido
    and p.deleted_at is null
  limit 1;

  select * into v_plano_novo
  from public.planos p
  where p.empresa_id = p_empresa_id
    and p.slug = btrim(p_plano_slug)
    and p.ativo = true
    and p.deleted_at is null
  limit 1;

  if v_plano_novo.id is null then
    raise exception 'plano_indisponivel' using errcode = 'P0001';
  end if;

  if v_plano_novo.slug = v_assinatura.plano_escolhido then
    raise exception 'plano_igual_ao_atual' using errcode = 'P0001';
  end if;

  if coalesce(v_plano_novo.preco, 0) > coalesce(v_plano_atual.preco, 0) then
    raise exception 'use_fluxo_upgrade' using errcode = 'P0001';
  end if;

  update public.assinaturas a
  set proximo_plano = v_plano_novo.slug,
      upgrade_pendente = null
  where a.id = v_assinatura.id
  returning * into v_assinatura;

  return v_assinatura;
end;
$function$;

create or replace function app_private.solicitar_upgrade_plano_cliente(
  p_empresa_id uuid,
  p_plano_slug text
)
returns public.assinaturas
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cliente_id uuid := auth.uid();
  v_assinatura public.assinaturas;
  v_plano_atual public.planos;
  v_plano_novo public.planos;
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
    and a.status = 'ativa'
    and a.plano_escolhido is not null
    and a.data_vencimento >= now()
  limit 1
  for update;

  if v_assinatura.id is null then
    raise exception 'plano_ativo_nao_encontrado' using errcode = 'P0001';
  end if;

  if v_assinatura.solicitacao_plano_slug is not null then
    if v_assinatura.solicitacao_tipo = 'upgrade'
       and v_assinatura.solicitacao_plano_slug = btrim(p_plano_slug)
    then
      return v_assinatura;
    end if;
    raise exception 'solicitacao_plano_pendente' using errcode = 'P0001';
  end if;

  select * into v_plano_atual
  from public.planos p
  where p.empresa_id = p_empresa_id
    and p.slug = v_assinatura.plano_escolhido
    and p.deleted_at is null
  limit 1;

  select * into v_plano_novo
  from public.planos p
  where p.empresa_id = p_empresa_id
    and p.slug = btrim(p_plano_slug)
    and p.ativo = true
    and p.deleted_at is null
  limit 1;

  if v_plano_novo.id is null then
    raise exception 'plano_indisponivel' using errcode = 'P0001';
  end if;

  if coalesce(v_plano_novo.preco, 0) <= coalesce(v_plano_atual.preco, 0) then
    raise exception 'use_fluxo_mudanca_plano' using errcode = 'P0001';
  end if;

  update public.assinaturas a
  set upgrade_pendente = v_plano_novo.slug,
      proximo_plano = null,
      solicitacao_plano_slug = v_plano_novo.slug,
      solicitacao_plano_nome = v_plano_novo.nome,
      solicitacao_plano_preco = v_plano_novo.preco,
      solicitacao_tipo = 'upgrade',
      solicitacao_forma_pagamento = 'nao_informado',
      solicitacao_em = now()
  where a.id = v_assinatura.id
  returning * into v_assinatura;

  return v_assinatura;
end;
$function$;

create or replace function app_private.cancelar_mudanca_plano_cliente(p_empresa_id uuid)
returns public.assinaturas
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cliente_id uuid := auth.uid();
  v_assinatura public.assinaturas;
begin
  if v_cliente_id is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  if app_private.usuario_cliente_empresa(p_empresa_id) is not true then
    raise exception 'cliente_sem_acesso_empresa' using errcode = 'P0001';
  end if;

  update public.assinaturas a
  set proximo_plano = null,
      upgrade_pendente = null,
      solicitacao_plano_slug = null,
      solicitacao_plano_nome = null,
      solicitacao_plano_preco = null,
      solicitacao_tipo = null,
      solicitacao_forma_pagamento = null,
      solicitacao_em = null
  where a.empresa_id = p_empresa_id
    and a.cliente_id = v_cliente_id
    and a.status = 'ativa'
  returning * into v_assinatura;

  if v_assinatura.id is null then
    raise exception 'plano_ativo_nao_encontrado' using errcode = 'P0001';
  end if;

  return v_assinatura;
end;
$function$;

create or replace function app_private.confirmar_upgrade_plano(p_assinatura_id uuid)
returns public.assinaturas
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_assinatura public.assinaturas;
  v_plano_atual public.planos;
  v_plano_novo public.planos;
begin
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
     or v_assinatura.data_vencimento is null
     or v_assinatura.data_vencimento < now()
  then
    raise exception 'plano_ativo_nao_encontrado' using errcode = 'P0001';
  end if;

  if v_assinatura.upgrade_pendente is null then
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
    and p.slug = coalesce(v_assinatura.solicitacao_plano_slug, v_assinatura.upgrade_pendente)
    and p.ativo = true
    and p.deleted_at is null
  limit 1;

  if v_plano_novo.id is null then
    raise exception 'plano_indisponivel' using errcode = 'P0001';
  end if;

  if coalesce(v_plano_novo.preco, 0) <= coalesce(v_plano_atual.preco, 0) then
    raise exception 'upgrade_invalido' using errcode = 'P0001';
  end if;

  update public.assinaturas a
  set plano_escolhido = v_plano_novo.slug,
      upgrade_pendente = null,
      proximo_plano = null,
      solicitacao_plano_slug = null,
      solicitacao_plano_nome = null,
      solicitacao_plano_preco = null,
      solicitacao_tipo = null,
      solicitacao_forma_pagamento = null,
      solicitacao_em = null,
      status = 'ativa'
  where a.id = v_assinatura.id
  returning * into v_assinatura;

  return v_assinatura;
end;
$function$;

create or replace function public.confirmar_pagamento_plano(p_assinatura_id uuid)
returns public.assinaturas
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_assinatura public.assinaturas;
  v_plano public.planos;
  v_agora timestamptz := now();
  v_plano_slug text;
  v_tipo_solicitacao text;
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

  if v_assinatura.status = 'ativa'
     and v_assinatura.data_vencimento >= v_agora
     and v_assinatura.solicitacao_tipo is distinct from 'renovacao'
  then
    raise exception 'plano_ja_ativo' using errcode = 'P0001';
  end if;

  v_plano_slug := coalesce(v_assinatura.solicitacao_plano_slug, v_assinatura.plano_escolhido);
  v_tipo_solicitacao := v_assinatura.solicitacao_tipo;

  select * into v_plano
  from public.planos p
  where p.empresa_id = v_assinatura.empresa_id
    and p.slug = v_plano_slug
    and p.ativo = true
    and p.deleted_at is null
  limit 1;

  if v_plano.id is null then
    raise exception 'plano_indisponivel' using errcode = 'P0001';
  end if;

  update public.assinatura_ciclos c
  set encerrado_em = v_agora
  where c.assinatura_id = v_assinatura.id
    and c.encerrado_em is null
    and v_agora >= c.iniciado_em
    and v_agora <= c.vencimento_em;

  update public.assinaturas a
  set plano_escolhido = v_plano.slug,
      status = 'ativa',
      ativada_em = v_agora,
      data_vencimento = v_agora + interval '30 days',
      proximo_plano = null,
      upgrade_pendente = null,
      solicitacao_plano_slug = null,
      solicitacao_plano_nome = null,
      solicitacao_plano_preco = null,
      solicitacao_tipo = null,
      solicitacao_forma_pagamento = null,
      solicitacao_em = null
  where a.id = v_assinatura.id
  returning * into v_assinatura;

  insert into public.assinatura_ciclos (
    assinatura_id,
    empresa_id,
    cliente_id,
    plano_id,
    plano_slug,
    plano_nome,
    limite,
    ilimitado,
    duracao_minutos,
    preco,
    iniciado_em,
    vencimento_em,
    origem
  ) values (
    v_assinatura.id,
    v_assinatura.empresa_id,
    v_assinatura.cliente_id,
    v_plano.id,
    v_plano.slug,
    v_plano.nome,
    greatest(coalesce(v_plano.limite, 0), 0),
    coalesce(v_plano.ilimitado, false),
    greatest(coalesce(v_plano.duracao_minutos, 30), 1),
    coalesce(v_plano.preco, 0),
    v_assinatura.ativada_em,
    v_assinatura.data_vencimento,
    case when v_tipo_solicitacao = 'renovacao' then 'renovacao' else 'ativacao' end
  )
  on conflict (assinatura_id, iniciado_em) do nothing;

  return v_assinatura;
end;
$function$;

create or replace function public.expirar_assinaturas_vencidas()
returns integer
language plpgsql
set search_path = 'public'
as $function$
declare
  v_total integer := 0;
begin
  update public.assinaturas
  set status = 'inativa'
  where status = 'ativa'
    and data_vencimento is not null
    and data_vencimento < now();

  get diagnostics v_total = row_count;

  update public.assinaturas
  set proximo_plano = null,
      upgrade_pendente = null
  where data_vencimento is not null
    and data_vencimento < now() - interval '30 days'
    and solicitacao_plano_slug is null
    and (proximo_plano is not null or upgrade_pendente is not null);

  return v_total;
end;
$function$;

revoke execute on function app_private.solicitar_mudanca_plano_cliente(uuid, text) from public, anon;
grant execute on function app_private.solicitar_mudanca_plano_cliente(uuid, text) to authenticated, service_role;
revoke execute on function app_private.solicitar_upgrade_plano_cliente(uuid, text) from public, anon;
grant execute on function app_private.solicitar_upgrade_plano_cliente(uuid, text) to authenticated, service_role;
revoke execute on function app_private.cancelar_mudanca_plano_cliente(uuid) from public, anon;
grant execute on function app_private.cancelar_mudanca_plano_cliente(uuid) to authenticated, service_role;
revoke execute on function app_private.confirmar_upgrade_plano(uuid) from public, anon;
grant execute on function app_private.confirmar_upgrade_plano(uuid) to authenticated, service_role;
revoke execute on function public.confirmar_pagamento_plano(uuid) from public, anon;
grant execute on function public.confirmar_pagamento_plano(uuid) to authenticated, service_role;
revoke execute on function public.expirar_assinaturas_vencidas() from public, anon, authenticated;
grant execute on function public.expirar_assinaturas_vencidas() to service_role;

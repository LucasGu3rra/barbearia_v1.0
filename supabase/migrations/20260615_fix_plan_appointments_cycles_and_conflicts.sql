create extension if not exists btree_gist with schema extensions;

alter table public.assinaturas
  add column if not exists ativada_em timestamptz;

update public.assinaturas
set ativada_em = greatest(
  coalesce(created_at, data_vencimento - interval '30 days'),
  data_vencimento - interval '30 days'
)
where status = 'ativa'
  and data_vencimento is not null
  and ativada_em is null;

create or replace function public.definir_ciclo_assinatura()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status = 'ativa' and (
    tg_op = 'INSERT'
    or old.status is distinct from 'ativa'
    or new.ativada_em is null
  ) then
    new.ativada_em := coalesce(new.ativada_em, now());
    new.data_vencimento := coalesce(new.data_vencimento, new.ativada_em + interval '30 days');
  elsif new.status = 'pendente' then
    new.ativada_em := null;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_definir_ciclo_assinatura on public.assinaturas;
create trigger trg_definir_ciclo_assinatura
before insert or update of status, data_vencimento, ativada_em
on public.assinaturas
for each row execute function public.definir_ciclo_assinatura();

alter table public.agendamentos
  add column if not exists plano_id uuid references public.planos(id) on update cascade on delete set null;

alter table public.agendamentos
  alter column servico_id drop not null;

alter table public.agendamentos
  drop constraint if exists agendamentos_origem_valida;

alter table public.agendamentos
  add constraint agendamentos_origem_valida check (
    (
      tipo_cliente = 'assinante'
      and plano_id is not null
    )
    or
    (
      coalesce(tipo_cliente, 'avulso') <> 'assinante'
      and servico_id is not null
    )
  ) not valid;

alter table public.agendamentos
  validate constraint agendamentos_origem_valida;

create index if not exists idx_agendamentos_plano_id
  on public.agendamentos(plano_id);

alter table public.agendamentos
  drop constraint if exists agendamentos_barbeiro_sem_sobreposicao;

alter table public.agendamentos
  add constraint agendamentos_barbeiro_sem_sobreposicao
  exclude using gist (
    empresa_id with =,
    barbeiro_id with =,
    tsrange(
      data_hora at time zone 'UTC',
      (data_hora at time zone 'UTC') + make_interval(mins => duracao_minutos),
      '[)'
    ) with &&
  )
  where (
    barbeiro_id is not null
    and coalesce(status, 'agendado') not in ('cancelado', 'cancelada', 'finalizado', 'concluido')
  );

create or replace function app_private.agendamentos_ocupados_dia(
  p_empresa_id uuid,
  p_filial_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table(barbeiro_id uuid, data_hora timestamptz, duracao_minutos integer)
language sql
stable
security definer
set search_path to 'public', 'app_private'
as $function$
  select
    a.barbeiro_id,
    a.data_hora,
    coalesce(a.duracao_minutos, s.duracao_minutos, p.duracao_minutos, 30) as duracao_minutos
  from public.agendamentos a
  left join public.servicos s on s.id = a.servico_id
  left join public.planos p on p.id = a.plano_id
  where a.empresa_id = p_empresa_id
    and a.filial_id = p_filial_id
    and coalesce(a.status, 'agendado') not in ('cancelado', 'cancelada', 'finalizado', 'concluido')
    and a.data_hora < p_fim
    and (
      a.data_hora
      + make_interval(mins => coalesce(a.duracao_minutos, s.duracao_minutos, p.duracao_minutos, 30))
    ) > p_inicio
    and app_private.usuario_pertence_empresa(p_empresa_id);
$function$;

create or replace function public.validar_conflito_agendamento()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_inicio_novo timestamptz;
  v_fim_novo timestamptz;
  v_duracao_nova integer;
  v_plano record;
begin
  if coalesce(new.status, 'agendado') not in ('cancelado', 'cancelada', 'finalizado', 'concluido') then
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
      new.duracao_minutos := coalesce(new.duracao_minutos, v_plano.duracao_minutos, 30);
    else
      if new.servico_id is null then
        raise exception 'servico_obrigatorio' using errcode = 'P0001';
      end if;

      new.plano_id := null;
      if new.duracao_minutos is null then
        select coalesce(s.duracao_minutos, 30)
          into new.duracao_minutos
        from public.servicos s
        where s.id = new.servico_id
          and s.empresa_id = new.empresa_id;
      end if;
    end if;

    v_duracao_nova := coalesce(new.duracao_minutos, 30);
    new.duracao_minutos := v_duracao_nova;
    v_inicio_novo := new.data_hora;
    v_fim_novo := new.data_hora + make_interval(mins => v_duracao_nova);

    if coalesce(new.tipo_cliente, 'avulso') = 'avulso' and exists (
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
      left join public.servicos s on s.id = a.servico_id
      left join public.planos p on p.id = a.plano_id
      where a.empresa_id = new.empresa_id
        and a.cliente_id = new.cliente_id
        and coalesce(a.status, 'agendado') not in ('cancelado', 'cancelada', 'finalizado', 'concluido')
        and a.id is distinct from new.id
        and a.data_hora < v_fim_novo
        and (
          a.data_hora
          + make_interval(mins => coalesce(a.duracao_minutos, s.duracao_minutos, p.duracao_minutos, 30))
        ) > v_inicio_novo
    ) then
      raise exception 'cliente_agendamento_conflito' using errcode = '23505';
    end if;

    if new.barbeiro_id is not null and exists (
      select 1
      from public.agendamentos a
      left join public.servicos s on s.id = a.servico_id
      left join public.planos p on p.id = a.plano_id
      where a.empresa_id = new.empresa_id
        and a.barbeiro_id = new.barbeiro_id
        and coalesce(a.status, 'agendado') not in ('cancelado', 'cancelada', 'finalizado', 'concluido')
        and a.id is distinct from new.id
        and a.data_hora < v_fim_novo
        and (
          a.data_hora
          + make_interval(mins => coalesce(a.duracao_minutos, s.duracao_minutos, p.duracao_minutos, 30))
        ) > v_inicio_novo
    ) then
      raise exception 'barbeiro_agendamento_conflito' using errcode = '23505';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.validar_agendamento_plano_diario()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_conflito uuid;
  v_assinatura record;
  v_plano record;
  v_usos_ciclo integer := 0;
  v_inicio_ciclo timestamptz;
begin
  if coalesce(new.status, 'agendado') in ('finalizado', 'concluido', 'cancelado', 'cancelada') then
    return new;
  end if;

  if new.tipo_cliente = 'assinante' then
    select a.* into v_assinatura
    from public.assinaturas a
    where a.empresa_id = new.empresa_id
      and a.cliente_id = new.cliente_id
      and a.status = 'ativa'
      and a.plano_escolhido is not null
      and a.data_vencimento >= new.data_hora
      and coalesce(a.ativada_em, a.data_vencimento - interval '30 days', a.created_at) <= new.data_hora
    order by a.created_at desc
    limit 1;

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

    select a.id into v_conflito
    from public.agendamentos a
    where a.empresa_id = new.empresa_id
      and a.cliente_id = new.cliente_id
      and a.tipo_cliente = 'assinante'
      and coalesce(a.status, 'agendado') not in ('cancelado', 'cancelada', 'finalizado', 'concluido')
      and a.id is distinct from new.id
      and (a.data_hora at time zone 'America/Sao_Paulo')::date =
          (new.data_hora at time zone 'America/Sao_Paulo')::date
    limit 1;

    if v_conflito is not null then
      raise exception 'cliente_plano_agendamento_dia_conflito' using errcode = 'P0001';
    end if;

    if coalesce(v_plano.ilimitado, false) is not true then
      select (
        (
          select count(*)::integer
          from public.historico_cortes h
          where h.empresa_id = new.empresa_id
            and h.cliente_id = new.cliente_id
            and coalesce(h.status, 'feito') not in ('cancelado', 'cancelada')
            and h.created_at >= v_inicio_ciclo
            and h.created_at <= v_assinatura.data_vencimento
        )
        +
        (
          select count(*)::integer
          from public.agendamentos a
          where a.empresa_id = new.empresa_id
            and a.cliente_id = new.cliente_id
            and a.tipo_cliente = 'assinante'
            and a.id is distinct from new.id
            and coalesce(a.status, 'agendado') not in ('cancelado', 'cancelada')
            and a.data_hora >= v_inicio_ciclo
            and a.data_hora <= v_assinatura.data_vencimento
        )
      ) into v_usos_ciclo;

      if v_usos_ciclo >= greatest(coalesce(v_plano.limite, 0), 0) then
        raise exception 'limite_plano_atingido' using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$function$;

create or replace function app_private.confirmar_corte_plano(p_empresa_id uuid)
returns public.historico_cortes
language plpgsql
security definer
set search_path to 'public', 'app_private'
as $function$
declare
  v_cliente_id uuid := auth.uid();
  v_assinatura record;
  v_plano record;
  v_prazo integer := 120;
  v_usados integer := 0;
  v_usados_dia integer := 0;
  v_inicio_ciclo timestamptz;
  v_corte public.historico_cortes;
begin
  if v_cliente_id is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  if not app_private.usuario_cliente_empresa(p_empresa_id) then
    raise exception 'cliente_sem_acesso_empresa' using errcode = 'P0001';
  end if;

  perform public.expirar_assinaturas_vencidas();

  select a.* into v_assinatura
  from public.assinaturas a
  where a.empresa_id = p_empresa_id
    and a.cliente_id = v_cliente_id
    and a.status = 'ativa'
    and a.plano_escolhido is not null
    and a.data_vencimento >= now()
    and coalesce(a.ativada_em, a.data_vencimento - interval '30 days', a.created_at) <= now()
  order by a.created_at desc
  limit 1;

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

  select coalesce(
    (c.valor ->> 'prazo_cancelamento_minutos')::integer,
    (c.valor ->> 'cancelamento_minutos')::integer,
    120
  )
  into v_prazo
  from public.configuracoes c
  where c.empresa_id = p_empresa_id
    and c.chave = 'fluxo_agendamento'
  limit 1;

  v_prazo := greatest(coalesce(v_prazo, 120), 0);

  select (
    (
      select count(*)::integer
      from public.historico_cortes h
      where h.empresa_id = p_empresa_id
        and h.cliente_id = v_cliente_id
        and coalesce(h.status, 'feito') not in ('cancelado', 'cancelada')
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
    select (
      (
        select count(*)::integer
        from public.historico_cortes h
        where h.empresa_id = p_empresa_id
          and h.cliente_id = v_cliente_id
          and coalesce(h.status, 'feito') not in ('cancelado', 'cancelada')
          and h.created_at >= v_inicio_ciclo
          and h.created_at <= v_assinatura.data_vencimento
      )
      +
      (
        select count(*)::integer
        from public.agendamentos a
        where a.empresa_id = p_empresa_id
          and a.cliente_id = v_cliente_id
          and a.tipo_cliente = 'assinante'
          and coalesce(a.status, 'agendado') not in ('cancelado', 'cancelada')
          and a.data_hora >= v_inicio_ciclo
          and a.data_hora <= v_assinatura.data_vencimento
      )
    ) into v_usados;

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
    cancelavel_ate
  ) values (
    p_empresa_id,
    v_cliente_id,
    v_plano.nome,
    'feito',
    'plano_confirmacao',
    v_plano.slug,
    now() + make_interval(mins => v_prazo)
  )
  returning * into v_corte;

  return v_corte;
end;
$function$;

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
  v_assinatura public.assinaturas;
begin
  if v_cliente_id is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  if not app_private.usuario_cliente_empresa(p_empresa_id) then
    raise exception 'cliente_sem_acesso_empresa' using errcode = 'P0001';
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

  select * into v_assinatura
  from public.assinaturas a
  where a.empresa_id = p_empresa_id
    and a.cliente_id = v_cliente_id
  order by a.created_at desc
  limit 1;

  if v_assinatura.id is not null
     and v_assinatura.status = 'ativa'
     and v_assinatura.data_vencimento >= now() then
    raise exception 'plano_ativo_ja_existente' using errcode = 'P0001';
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
begin
  update public.assinaturas
  set status = 'inativa'
  where status = 'ativa'
    and data_vencimento is not null
    and data_vencimento < now();
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

  return jsonb_build_object(
    'assinaturas_expiradas', v_assinaturas_expiradas,
    'agendamentos_finalizados', v_agendamentos_finalizados,
    'notificacoes_removidas', v_notificacoes_removidas,
    'executado_em', now()
  );
end;
$function$;

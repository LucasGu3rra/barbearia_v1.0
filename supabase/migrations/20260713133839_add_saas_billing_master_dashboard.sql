create table if not exists public.planos_sistema (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  descricao text not null default '',
  sem_vencimento boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planos_sistema_codigo_check check (codigo ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint planos_sistema_nome_check check (btrim(nome) <> '')
);

create table if not exists public.recursos_sistema (
  codigo text primary key,
  nome text not null,
  descricao text not null default '',
  created_at timestamptz not null default now(),
  constraint recursos_sistema_codigo_check check (codigo ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint recursos_sistema_nome_check check (btrim(nome) <> '')
);

create table if not exists public.plano_sistema_recursos (
  plano_id uuid not null references public.planos_sistema(id) on delete cascade,
  recurso_codigo text not null references public.recursos_sistema(codigo) on delete cascade,
  habilitado boolean not null default true,
  limite integer,
  created_at timestamptz not null default now(),
  primary key (plano_id, recurso_codigo),
  constraint plano_sistema_recursos_limite_check check (limite is null or limite >= 0)
);

create table if not exists public.assinaturas_empresas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null unique references public.empresas(id) on delete cascade,
  plano_sistema_id uuid not null references public.planos_sistema(id) on delete restrict,
  status text not null default 'cortesia',
  valor_mensal numeric(12,2) not null default 0,
  dia_vencimento integer,
  proximo_vencimento date,
  iniciada_em timestamptz not null default now(),
  ultimo_pagamento_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assinaturas_empresas_status_check
    check (status in ('ativo', 'cortesia', 'vencido', 'suspenso', 'cancelado')),
  constraint assinaturas_empresas_valor_check check (valor_mensal >= 0),
  constraint assinaturas_empresas_dia_check
    check (dia_vencimento is null or dia_vencimento in (5, 10, 15, 20))
);

create table if not exists public.mensalidades_empresas (
  id uuid primary key default gen_random_uuid(),
  assinatura_empresa_id uuid not null references public.assinaturas_empresas(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  plano_codigo text not null,
  plano_nome text not null,
  competencia date not null,
  vencimento date not null,
  valor numeric(12,2) not null,
  status text not null default 'pendente',
  pago_em timestamptz,
  confirmado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mensalidades_empresas_status_check
    check (status in ('pendente', 'vencida', 'paga', 'cancelada')),
  constraint mensalidades_empresas_valor_check check (valor >= 0),
  constraint mensalidades_empresas_empresa_vencimento_unique unique (empresa_id, vencimento)
);

create table if not exists public.assinaturas_empresas_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  assinatura_empresa_id uuid references public.assinaturas_empresas(id) on delete set null,
  tipo text not null,
  dados_anteriores jsonb,
  dados_novos jsonb,
  realizado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint assinaturas_empresas_eventos_tipo_check check (btrim(tipo) <> '')
);

create index if not exists assinaturas_empresas_status_vencimento_idx
  on public.assinaturas_empresas (status, proximo_vencimento)
  where status in ('ativo', 'vencido', 'suspenso');

create index if not exists mensalidades_empresas_status_vencimento_idx
  on public.mensalidades_empresas (status, vencimento)
  where status in ('pendente', 'vencida');

create index if not exists mensalidades_empresas_empresa_status_idx
  on public.mensalidades_empresas (empresa_id, status, vencimento);

create index if not exists assinaturas_empresas_eventos_empresa_created_idx
  on public.assinaturas_empresas_eventos (empresa_id, created_at desc);

alter table public.planos_sistema enable row level security;
alter table public.recursos_sistema enable row level security;
alter table public.plano_sistema_recursos enable row level security;
alter table public.assinaturas_empresas enable row level security;
alter table public.mensalidades_empresas enable row level security;
alter table public.assinaturas_empresas_eventos enable row level security;

grant select on public.planos_sistema to authenticated;
grant select on public.recursos_sistema to authenticated;
grant select on public.plano_sistema_recursos to authenticated;
grant select on public.assinaturas_empresas to authenticated;
grant select on public.mensalidades_empresas to authenticated;

revoke all on public.planos_sistema from anon;
revoke all on public.recursos_sistema from anon;
revoke all on public.plano_sistema_recursos from anon;
revoke all on public.assinaturas_empresas from anon;
revoke all on public.mensalidades_empresas from anon;
revoke all on public.assinaturas_empresas_eventos from anon, authenticated;

create policy "Admins leem assinatura do sistema da empresa"
on public.assinaturas_empresas
for select
to authenticated
using (app_private.usuario_admin_empresa(empresa_id));

create policy "Admins leem mensalidades da propria empresa"
on public.mensalidades_empresas
for select
to authenticated
using (app_private.usuario_admin_empresa(empresa_id));

create policy "Admins leem planos do sistema"
on public.planos_sistema
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios_empresas ue
    where ue.user_id = (select auth.uid())
      and ue.papel in ('dono', 'admin')
  )
);

create policy "Admins leem recursos do sistema"
on public.recursos_sistema
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios_empresas ue
    where ue.user_id = (select auth.uid())
      and ue.papel in ('dono', 'admin')
  )
);

create policy "Admins leem recursos dos planos do sistema"
on public.plano_sistema_recursos
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios_empresas ue
    where ue.user_id = (select auth.uid())
      and ue.papel in ('dono', 'admin')
  )
);

create or replace function app_private.definir_updated_at_sistema()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function app_private.definir_updated_at_sistema() from public, anon, authenticated;

drop trigger if exists trg_planos_sistema_updated_at on public.planos_sistema;
create trigger trg_planos_sistema_updated_at
before update on public.planos_sistema
for each row execute function app_private.definir_updated_at_sistema();

drop trigger if exists trg_assinaturas_empresas_updated_at on public.assinaturas_empresas;
create trigger trg_assinaturas_empresas_updated_at
before update on public.assinaturas_empresas
for each row execute function app_private.definir_updated_at_sistema();

drop trigger if exists trg_mensalidades_empresas_updated_at on public.mensalidades_empresas;
create trigger trg_mensalidades_empresas_updated_at
before update on public.mensalidades_empresas
for each row execute function app_private.definir_updated_at_sistema();

insert into public.planos_sistema (codigo, nome, descricao, sem_vencimento, ativo, ordem)
values
  ('basico', 'Basico', 'Recursos essenciais da BarbeariaClick.', false, true, 10),
  ('intermediario', 'Intermediario', 'Inclui modulos adicionais para a barbearia.', false, true, 20),
  ('premium', 'Premium', 'Plano completo para operacoes maiores.', false, true, 30),
  ('ilimitado', 'Ilimitado', 'Acesso permanente sem vencimento.', true, true, 40)
on conflict (codigo) do nothing;

insert into public.recursos_sistema (codigo, nome, descricao)
values ('catalogo_produtos', 'Catalogo de produtos', 'Cadastro, estoque e pedidos de produtos da barbearia.')
on conflict (codigo) do nothing;

insert into public.plano_sistema_recursos (plano_id, recurso_codigo, habilitado)
select p.id, 'catalogo_produtos', true
from public.planos_sistema p
where p.codigo in ('intermediario', 'premium', 'ilimitado')
on conflict (plano_id, recurso_codigo) do update
set habilitado = excluded.habilitado;

create or replace function app_private.sincronizar_mensalidade_assinatura_empresa()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_plano public.planos_sistema%rowtype;
  v_status_mensalidade text;
begin
  select * into v_plano
  from public.planos_sistema
  where id = new.plano_sistema_id;

  if not found then
    raise exception 'plano_sistema_invalido';
  end if;

  if v_plano.sem_vencimento
     or new.status in ('cortesia', 'cancelado')
     or new.proximo_vencimento is null
     or new.valor_mensal <= 0 then
    update public.mensalidades_empresas
    set status = 'cancelada', updated_at = now()
    where empresa_id = new.empresa_id
      and status in ('pendente', 'vencida');
    return new;
  end if;

  update public.mensalidades_empresas
  set status = 'cancelada', updated_at = now()
  where empresa_id = new.empresa_id
    and status in ('pendente', 'vencida')
    and vencimento <> new.proximo_vencimento;

  v_status_mensalidade := case
    when new.proximo_vencimento < (now() at time zone 'America/Sao_Paulo')::date then 'vencida'
    else 'pendente'
  end;

  insert into public.mensalidades_empresas (
    assinatura_empresa_id,
    empresa_id,
    plano_codigo,
    plano_nome,
    competencia,
    vencimento,
    valor,
    status
  ) values (
    new.id,
    new.empresa_id,
    v_plano.codigo,
    v_plano.nome,
    date_trunc('month', new.proximo_vencimento::timestamp)::date,
    new.proximo_vencimento,
    new.valor_mensal,
    v_status_mensalidade
  )
  on conflict (empresa_id, vencimento) do update
  set assinatura_empresa_id = excluded.assinatura_empresa_id,
      plano_codigo = excluded.plano_codigo,
      plano_nome = excluded.plano_nome,
      competencia = excluded.competencia,
      valor = case
        when public.mensalidades_empresas.status = 'paga' then public.mensalidades_empresas.valor
        else excluded.valor
      end,
      status = case
        when public.mensalidades_empresas.status = 'paga' then 'paga'
        else excluded.status
      end,
      updated_at = now();

  return new;
end;
$function$;

revoke all on function app_private.sincronizar_mensalidade_assinatura_empresa() from public, anon, authenticated;

drop trigger if exists trg_sincronizar_mensalidade_assinatura_empresa on public.assinaturas_empresas;
create trigger trg_sincronizar_mensalidade_assinatura_empresa
after insert or update of plano_sistema_id, status, valor_mensal, dia_vencimento, proximo_vencimento
on public.assinaturas_empresas
for each row execute function app_private.sincronizar_mensalidade_assinatura_empresa();

insert into public.assinaturas_empresas (
  empresa_id,
  plano_sistema_id,
  status,
  valor_mensal,
  dia_vencimento,
  proximo_vencimento
)
select e.id, p.id, 'cortesia', 0, null, null
from public.empresas e
cross join public.planos_sistema p
where p.codigo = 'basico'
on conflict (empresa_id) do nothing;

update public.assinaturas_empresas ae
set plano_sistema_id = p.id,
    status = 'ativo',
    valor_mensal = 0,
    dia_vencimento = null,
    proximo_vencimento = null,
    updated_at = now()
from public.planos_sistema p
where p.codigo = 'ilimitado'
  and ae.empresa_id = (
    select e.id
    from public.empresas e
    join public.usuarios_empresas ue
      on ue.empresa_id = e.id
     and ue.papel = 'dono'
    join auth.users u on u.id = ue.user_id
    where e.slug = 'barbeariadojoao'
      and lower(u.email) = 'joaobarber97@outlook.com'
    order by ue.created_at
    limit 1
  );

create or replace function app_private.processar_mensalidades_empresas()
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  update public.mensalidades_empresas
  set status = 'vencida', updated_at = now()
  where status = 'pendente'
    and vencimento < v_hoje;

  update public.assinaturas_empresas ae
  set status = 'vencido', updated_at = now()
  where ae.status = 'ativo'
    and ae.proximo_vencimento < v_hoje
    and exists (
      select 1
      from public.planos_sistema p
      where p.id = ae.plano_sistema_id
        and p.sem_vencimento = false
    );
end;
$function$;

revoke all on function app_private.processar_mensalidades_empresas() from public, anon, authenticated;

create or replace function public.master_dashboard_bootstrap()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $function$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null or not exists (
    select 1 from public.master_users mu where mu.user_id = v_usuario
  ) then
    raise exception 'acesso_master_negado';
  end if;

  return jsonb_build_object(
    'resumo', jsonb_build_object(
      'total_empresas', (select count(*) from public.empresas),
      'empresas_ativas', (select count(*) from public.empresas where ativa = true),
      'clientes_total', (select count(*) from public.clientes where coalesce(eh_admin, false) = false),
      'receita_mensal_prevista', coalesce((
        select sum(ae.valor_mensal)
        from public.assinaturas_empresas ae
        join public.planos_sistema ps on ps.id = ae.plano_sistema_id
        where ae.status in ('ativo', 'vencido')
          and ps.sem_vencimento = false
      ), 0),
      'mensalidades_atrasadas', (
        select count(*) from public.mensalidades_empresas where status = 'vencida'
      )
    ),
    'planos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', ps.id,
          'codigo', ps.codigo,
          'nome', ps.nome,
          'descricao', ps.descricao,
          'sem_vencimento', ps.sem_vencimento,
          'ativo', ps.ativo
        ) order by ps.ordem, ps.nome
      )
      from public.planos_sistema ps
      where ps.ativo = true
    ), '[]'::jsonb),
    'empresas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'nome', e.nome,
          'slug', e.slug,
          'ativa', e.ativa,
          'created_at', e.created_at,
          'dono_email', dono.email,
          'clientes_total', coalesce(clientes.total, 0),
          'barbeiros_total', coalesce(barbeiros.total, 0),
          'agendamentos_total', coalesce(agendamentos.total, 0),
          'assinatura', case when ae.id is null then null else jsonb_build_object(
            'id', ae.id,
            'status', ae.status,
            'valor_mensal', ae.valor_mensal,
            'dia_vencimento', ae.dia_vencimento,
            'proximo_vencimento', ae.proximo_vencimento,
            'ultimo_pagamento_em', ae.ultimo_pagamento_em,
            'plano_id', ps.id,
            'plano_codigo', ps.codigo,
            'plano_nome', ps.nome,
            'sem_vencimento', ps.sem_vencimento
          ) end,
          'mensalidade_aberta', case when mensalidade.id is null then null else jsonb_build_object(
            'id', mensalidade.id,
            'status', mensalidade.status,
            'vencimento', mensalidade.vencimento,
            'valor', mensalidade.valor,
            'plano_nome', mensalidade.plano_nome
          ) end
        ) order by e.ativa desc, e.nome
      )
      from public.empresas e
      left join public.assinaturas_empresas ae on ae.empresa_id = e.id
      left join public.planos_sistema ps on ps.id = ae.plano_sistema_id
      left join lateral (
        select u.email
        from public.usuarios_empresas ue
        join auth.users u on u.id = ue.user_id
        where ue.empresa_id = e.id and ue.papel = 'dono'
        order by ue.created_at
        limit 1
      ) dono on true
      left join lateral (
        select count(*)::integer as total
        from public.clientes c
        where c.empresa_id = e.id and coalesce(c.eh_admin, false) = false
      ) clientes on true
      left join lateral (
        select count(*)::integer as total
        from public.barbeiros b
        where b.empresa_id = e.id and b.ativo = true
      ) barbeiros on true
      left join lateral (
        select count(*)::integer as total
        from public.agendamentos a
        where a.empresa_id = e.id
      ) agendamentos on true
      left join lateral (
        select me.*
        from public.mensalidades_empresas me
        where me.empresa_id = e.id
          and me.status in ('pendente', 'vencida')
        order by me.vencimento
        limit 1
      ) mensalidade on true
    ), '[]'::jsonb)
  );
end;
$function$;

revoke execute on function public.master_dashboard_bootstrap() from public, anon;
grant execute on function public.master_dashboard_bootstrap() to authenticated, service_role;

create or replace function public.master_atualizar_assinatura_empresa(
  p_empresa_id uuid,
  p_plano_codigo text,
  p_status text,
  p_valor_mensal numeric,
  p_dia_vencimento integer,
  p_primeiro_vencimento date
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $function$
declare
  v_usuario uuid := auth.uid();
  v_plano public.planos_sistema%rowtype;
  v_anterior jsonb;
  v_assinatura public.assinaturas_empresas%rowtype;
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_valor numeric(12,2) := coalesce(p_valor_mensal, 0);
  v_dia integer := p_dia_vencimento;
  v_vencimento date := p_primeiro_vencimento;
begin
  if v_usuario is null or not exists (
    select 1 from public.master_users mu where mu.user_id = v_usuario
  ) then
    raise exception 'acesso_master_negado';
  end if;

  if not exists (select 1 from public.empresas e where e.id = p_empresa_id) then
    raise exception 'empresa_nao_encontrada';
  end if;

  select * into v_plano
  from public.planos_sistema
  where codigo = lower(btrim(coalesce(p_plano_codigo, '')))
    and ativo = true;

  if not found then
    raise exception 'plano_sistema_invalido';
  end if;

  if v_status not in ('ativo', 'cortesia', 'vencido', 'suspenso', 'cancelado') then
    raise exception 'status_assinatura_invalido';
  end if;

  if v_plano.sem_vencimento then
    v_status := 'ativo';
    v_valor := 0;
    v_dia := null;
    v_vencimento := null;
  elsif v_status in ('cortesia', 'cancelado') then
    v_valor := 0;
    v_dia := null;
    v_vencimento := null;
  else
    if v_valor <= 0 then
      raise exception 'valor_mensal_invalido';
    end if;
    if v_dia not in (5, 10, 15, 20) then
      raise exception 'dia_vencimento_invalido';
    end if;
    if v_vencimento is null or extract(day from v_vencimento)::integer <> v_dia then
      raise exception 'primeiro_vencimento_invalido';
    end if;
  end if;

  select to_jsonb(ae) into v_anterior
  from public.assinaturas_empresas ae
  where ae.empresa_id = p_empresa_id
  for update;

  insert into public.assinaturas_empresas (
    empresa_id,
    plano_sistema_id,
    status,
    valor_mensal,
    dia_vencimento,
    proximo_vencimento
  ) values (
    p_empresa_id,
    v_plano.id,
    v_status,
    v_valor,
    v_dia,
    v_vencimento
  )
  on conflict (empresa_id) do update
  set plano_sistema_id = excluded.plano_sistema_id,
      status = excluded.status,
      valor_mensal = excluded.valor_mensal,
      dia_vencimento = excluded.dia_vencimento,
      proximo_vencimento = excluded.proximo_vencimento,
      updated_at = now()
  returning * into v_assinatura;

  insert into public.assinaturas_empresas_eventos (
    empresa_id,
    assinatura_empresa_id,
    tipo,
    dados_anteriores,
    dados_novos,
    realizado_por
  ) values (
    p_empresa_id,
    v_assinatura.id,
    'assinatura_atualizada',
    v_anterior,
    to_jsonb(v_assinatura),
    v_usuario
  );

  return jsonb_build_object('ok', true, 'assinatura', to_jsonb(v_assinatura));
end;
$function$;

revoke execute on function public.master_atualizar_assinatura_empresa(uuid, text, text, numeric, integer, date) from public, anon;
grant execute on function public.master_atualizar_assinatura_empresa(uuid, text, text, numeric, integer, date) to authenticated, service_role;

create or replace function public.master_confirmar_mensalidade_empresa(p_empresa_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $function$
declare
  v_usuario uuid := auth.uid();
  v_assinatura public.assinaturas_empresas%rowtype;
  v_plano public.planos_sistema%rowtype;
  v_mensalidade public.mensalidades_empresas%rowtype;
  v_proximo date;
begin
  if v_usuario is null or not exists (
    select 1 from public.master_users mu where mu.user_id = v_usuario
  ) then
    raise exception 'acesso_master_negado';
  end if;

  select ae.* into v_assinatura
  from public.assinaturas_empresas ae
  where ae.empresa_id = p_empresa_id
  for update;

  if not found then
    raise exception 'assinatura_empresa_nao_encontrada';
  end if;

  select * into v_plano
  from public.planos_sistema
  where id = v_assinatura.plano_sistema_id;

  if v_plano.sem_vencimento or v_assinatura.status in ('cortesia', 'cancelado') then
    raise exception 'assinatura_sem_mensalidade';
  end if;

  select me.* into v_mensalidade
  from public.mensalidades_empresas me
  where me.empresa_id = p_empresa_id
    and me.status in ('pendente', 'vencida')
  order by me.vencimento
  limit 1
  for update;

  if not found then
    raise exception 'mensalidade_aberta_nao_encontrada';
  end if;

  update public.mensalidades_empresas
  set status = 'paga',
      pago_em = now(),
      confirmado_por = v_usuario,
      updated_at = now()
  where id = v_mensalidade.id;

  v_proximo := (date_trunc('month', v_mensalidade.vencimento::timestamp) + interval '1 month')::date
    + (v_assinatura.dia_vencimento - 1);

  update public.assinaturas_empresas
  set status = 'ativo',
      ultimo_pagamento_em = now(),
      proximo_vencimento = v_proximo,
      updated_at = now()
  where id = v_assinatura.id
  returning * into v_assinatura;

  insert into public.assinaturas_empresas_eventos (
    empresa_id,
    assinatura_empresa_id,
    tipo,
    dados_novos,
    realizado_por
  ) values (
    p_empresa_id,
    v_assinatura.id,
    'mensalidade_confirmada',
    jsonb_build_object(
      'mensalidade_id', v_mensalidade.id,
      'vencimento_pago', v_mensalidade.vencimento,
      'proximo_vencimento', v_proximo
    ),
    v_usuario
  );

  return jsonb_build_object(
    'ok', true,
    'mensalidade_id', v_mensalidade.id,
    'proximo_vencimento', v_proximo
  );
end;
$function$;

revoke execute on function public.master_confirmar_mensalidade_empresa(uuid) from public, anon;
grant execute on function public.master_confirmar_mensalidade_empresa(uuid) to authenticated, service_role;

create or replace function public.empresa_assinatura_sistema_resumo(p_empresa_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $function$
begin
  if app_private.usuario_admin_empresa(p_empresa_id) is not true then
    raise exception 'acesso_empresa_negado';
  end if;

  return (
    select jsonb_build_object(
      'assinatura', jsonb_build_object(
        'status', ae.status,
        'valor_mensal', ae.valor_mensal,
        'dia_vencimento', ae.dia_vencimento,
        'proximo_vencimento', ae.proximo_vencimento,
        'ultimo_pagamento_em', ae.ultimo_pagamento_em,
        'plano_codigo', ps.codigo,
        'plano_nome', ps.nome,
        'sem_vencimento', ps.sem_vencimento
      ),
      'mensalidade_aberta', case when me.id is null then null else jsonb_build_object(
        'id', me.id,
        'status', me.status,
        'vencimento', me.vencimento,
        'valor', me.valor
      ) end
    )
    from public.assinaturas_empresas ae
    join public.planos_sistema ps on ps.id = ae.plano_sistema_id
    left join lateral (
      select m.*
      from public.mensalidades_empresas m
      where m.empresa_id = ae.empresa_id
        and m.status in ('pendente', 'vencida')
      order by m.vencimento
      limit 1
    ) me on true
    where ae.empresa_id = p_empresa_id
  );
end;
$function$;

revoke execute on function public.empresa_assinatura_sistema_resumo(uuid) from public, anon;
grant execute on function public.empresa_assinatura_sistema_resumo(uuid) to authenticated, service_role;

select app_private.processar_mensalidades_empresas();

do $block$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for v_job_id in
      select jobid from cron.job where jobname = 'processar-mensalidades-empresas'
    loop
      perform cron.unschedule(v_job_id);
    end loop;

    perform cron.schedule(
      'processar-mensalidades-empresas',
      '10 3 * * *',
      'select app_private.processar_mensalidades_empresas();'
    );
  end if;
end;
$block$;

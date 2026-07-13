alter table public.agendamentos
  add column if not exists prazo_cancelamento_minutos_aplicado integer,
  add column if not exists cancelamento_normal_ate timestamptz,
  add column if not exists cancelamento_excepcional_ate timestamptz;

create or replace function app_private.definir_politica_cancelamento_agendamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_prazo integer := 120;
begin
  select greatest(coalesce(
    (c.valor ->> 'prazo_cancelamento_minutos')::integer,
    (c.valor ->> 'cancelamento_minutos')::integer,
    120
  ), 0)
  into v_prazo
  from public.configuracoes c
  where c.empresa_id = new.empresa_id
    and c.chave = 'fluxo_agendamento'
  limit 1;

  v_prazo := greatest(coalesce(v_prazo, 120), 0);
  new.prazo_cancelamento_minutos_aplicado := v_prazo;
  new.cancelamento_normal_ate := new.data_hora - make_interval(mins => v_prazo);
  new.cancelamento_excepcional_ate := case
    when new.tipo_cliente = 'assinante'
      and now() > new.cancelamento_normal_ate
    then least(now() + interval '5 minutes', new.data_hora)
    else null
  end;

  return new;
end;
$function$;

revoke execute on function app_private.definir_politica_cancelamento_agendamento()
  from public, anon, authenticated;

with politicas as (
  select
    a.id,
    greatest(coalesce(
      (c.valor ->> 'prazo_cancelamento_minutos')::integer,
      (c.valor ->> 'cancelamento_minutos')::integer,
      120
    ), 0) as prazo
  from public.agendamentos a
  left join public.configuracoes c
    on c.empresa_id = a.empresa_id
   and c.chave = 'fluxo_agendamento'
)
update public.agendamentos a
set
  prazo_cancelamento_minutos_aplicado = p.prazo,
  cancelamento_normal_ate = a.data_hora - make_interval(mins => p.prazo),
  cancelamento_excepcional_ate = case
    when a.tipo_cliente = 'assinante'
      and a.created_at > a.data_hora - make_interval(mins => p.prazo)
    then least(a.created_at + interval '5 minutes', a.data_hora)
    else null
  end
from politicas p
where p.id = a.id
  and (
    a.prazo_cancelamento_minutos_aplicado is null
    or a.cancelamento_normal_ate is null
  );

alter table public.agendamentos
  alter column prazo_cancelamento_minutos_aplicado set not null,
  alter column cancelamento_normal_ate set not null;

alter table public.agendamentos
  drop constraint if exists agendamentos_prazo_cancelamento_aplicado_check,
  add constraint agendamentos_prazo_cancelamento_aplicado_check
    check (prazo_cancelamento_minutos_aplicado >= 0) not valid,
  drop constraint if exists agendamentos_cancelamento_normal_limite_check,
  add constraint agendamentos_cancelamento_normal_limite_check
    check (cancelamento_normal_ate <= data_hora) not valid,
  drop constraint if exists agendamentos_cancelamento_excepcional_limite_check,
  add constraint agendamentos_cancelamento_excepcional_limite_check
    check (
      cancelamento_excepcional_ate is null
      or cancelamento_excepcional_ate <= data_hora
    ) not valid;

alter table public.agendamentos
  validate constraint agendamentos_prazo_cancelamento_aplicado_check;
alter table public.agendamentos
  validate constraint agendamentos_cancelamento_normal_limite_check;
alter table public.agendamentos
  validate constraint agendamentos_cancelamento_excepcional_limite_check;

drop trigger if exists trg_definir_politica_cancelamento_agendamento
  on public.agendamentos;
create trigger trg_definir_politica_cancelamento_agendamento
before insert or update of
  empresa_id,
  data_hora,
  tipo_cliente,
  prazo_cancelamento_minutos_aplicado,
  cancelamento_normal_ate,
  cancelamento_excepcional_ate
on public.agendamentos
for each row
execute function app_private.definir_politica_cancelamento_agendamento();

create or replace function app_private.cancelar_agendamento_cliente(p_agendamento_id uuid)
returns public.agendamentos
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cliente_id uuid := auth.uid();
  v_agendamento public.agendamentos;
  v_cancelamento_normal boolean := false;
  v_cancelamento_excepcional boolean := false;
begin
  if v_cliente_id is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  select * into v_agendamento
  from public.agendamentos a
  where a.id = p_agendamento_id
    and a.cliente_id = v_cliente_id
    and coalesce(a.status, 'agendado') not in (
      'cancelado', 'cancelada', 'finalizado', 'concluido'
    )
  limit 1;

  if v_agendamento.id is null then
    raise exception 'agendamento_nao_encontrado' using errcode = 'P0001';
  end if;

  if app_private.usuario_cliente_empresa(v_agendamento.empresa_id) is not true then
    raise exception 'cliente_sem_acesso_empresa' using errcode = 'P0001';
  end if;

  v_cancelamento_normal := now() <= v_agendamento.cancelamento_normal_ate;
  v_cancelamento_excepcional :=
    v_agendamento.tipo_cliente = 'assinante'
    and v_agendamento.cancelamento_excepcional_ate is not null
    and now() <= v_agendamento.cancelamento_excepcional_ate;

  if not (v_cancelamento_normal or v_cancelamento_excepcional) then
    raise exception 'cancelamento_agendamento_indisponivel' using errcode = 'P0001';
  end if;

  update public.agendamentos a
  set status = 'cancelado'
  where a.id = v_agendamento.id
  returning * into v_agendamento;

  return v_agendamento;
end;
$function$;

revoke execute on function app_private.cancelar_agendamento_cliente(uuid)
  from public, anon;
grant execute on function app_private.cancelar_agendamento_cliente(uuid)
  to authenticated;

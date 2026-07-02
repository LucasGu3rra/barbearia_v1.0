create table if not exists public.auth_user_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  updated_at timestamptz not null default now()
);

alter table public.auth_user_emails enable row level security;
revoke all on table public.auth_user_emails from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_user_emails to service_role;

insert into public.auth_user_emails (user_id, email)
select u.id, lower(u.email)
from auth.users u
where u.email is not null
on conflict (user_id) do update
set email = excluded.email,
    updated_at = now();

create or replace function app_private.sincronizar_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
begin
  if tg_op = 'DELETE' then
    delete from public.auth_user_emails where user_id = old.id;
    return old;
  end if;

  if new.email is null or btrim(new.email) = '' then
    delete from public.auth_user_emails where user_id = new.id;
    return new;
  end if;

  insert into public.auth_user_emails (user_id, email, updated_at)
  values (new.id, lower(new.email), now())
  on conflict (user_id) do update
  set email = excluded.email,
      updated_at = now();

  return new;
end;
$function$;

drop trigger if exists trg_sincronizar_auth_user_email on auth.users;
create trigger trg_sincronizar_auth_user_email
after insert or update of email or delete
on auth.users
for each row execute function app_private.sincronizar_auth_user_email();

revoke execute on function app_private.sincronizar_auth_user_email() from public, anon, authenticated;

create table if not exists public.cadastro_rate_limits (
  identifier text primary key,
  attempts integer not null default 0,
  window_start timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.cadastro_rate_limits enable row level security;
revoke all on table public.cadastro_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.cadastro_rate_limits to service_role;

create or replace function public.registrar_tentativa_cadastro(
  p_identificador text,
  p_limite integer default 5,
  p_janela_minutos integer default 60,
  p_bloqueio_minutos integer default 30
)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_agora timestamptz := now();
  v_limite integer := greatest(coalesce(p_limite, 5), 1);
  v_janela interval := make_interval(mins => greatest(coalesce(p_janela_minutos, 60), 1));
  v_bloqueio interval := make_interval(mins => greatest(coalesce(p_bloqueio_minutos, 30), 1));
  v_registro public.cadastro_rate_limits;
  v_tentativas integer;
begin
  if p_identificador is null or btrim(p_identificador) = '' then
    return jsonb_build_object('allowed', false, 'retry_after_seconds', 60);
  end if;

  insert into public.cadastro_rate_limits (identifier, attempts, window_start, updated_at)
  values (p_identificador, 0, v_agora, v_agora)
  on conflict (identifier) do nothing;

  select *
  into v_registro
  from public.cadastro_rate_limits
  where identifier = p_identificador
  for update;

  if v_registro.blocked_until is not null and v_registro.blocked_until > v_agora then
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', ceil(extract(epoch from (v_registro.blocked_until - v_agora)))::integer
    );
  end if;

  if v_registro.window_start <= v_agora - v_janela then
    update public.cadastro_rate_limits
    set attempts = 1,
        window_start = v_agora,
        blocked_until = null,
        updated_at = v_agora
    where identifier = p_identificador;

    return jsonb_build_object('allowed', true, 'attempts', 1);
  end if;

  v_tentativas := v_registro.attempts + 1;

  if v_tentativas > v_limite then
    update public.cadastro_rate_limits
    set attempts = v_tentativas,
        blocked_until = v_agora + v_bloqueio,
        updated_at = v_agora
    where identifier = p_identificador;

    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', ceil(extract(epoch from v_bloqueio))::integer
    );
  end if;

  update public.cadastro_rate_limits
  set attempts = v_tentativas,
      blocked_until = null,
      updated_at = v_agora
  where identifier = p_identificador;

  return jsonb_build_object('allowed', true, 'attempts', v_tentativas);
end;
$function$;

revoke execute on function public.registrar_tentativa_cadastro(text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.registrar_tentativa_cadastro(text, integer, integer, integer) to service_role;

revoke execute on function public.cancelar_agendamento_cliente(uuid) from public, anon;
grant execute on function public.cancelar_agendamento_cliente(uuid) to authenticated, service_role;

revoke execute on function public.cancelar_corte_plano(uuid) from public, anon;
grant execute on function public.cancelar_corte_plano(uuid) to authenticated, service_role;

revoke execute on function public.confirmar_corte_plano(uuid) from public, anon;
grant execute on function public.confirmar_corte_plano(uuid) to authenticated, service_role;

revoke execute on function public.solicitar_plano_cliente(uuid, text) from public, anon;
grant execute on function public.solicitar_plano_cliente(uuid, text) to authenticated, service_role;

revoke execute on function public.solicitar_mudanca_plano_cliente(uuid, text) from public, anon;
grant execute on function public.solicitar_mudanca_plano_cliente(uuid, text) to authenticated, service_role;

revoke execute on function public.solicitar_upgrade_plano_cliente(uuid, text) from public, anon;
grant execute on function public.solicitar_upgrade_plano_cliente(uuid, text) to authenticated, service_role;

revoke execute on function public.cancelar_mudanca_plano_cliente(uuid) from public, anon;
grant execute on function public.cancelar_mudanca_plano_cliente(uuid) to authenticated, service_role;

revoke execute on function public.agendamentos_ocupados_dia(uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.agendamentos_ocupados_dia(uuid, uuid, timestamptz, timestamptz) to authenticated, service_role;

revoke execute on function public.expirar_assinaturas_vencidas() from public, anon, authenticated;
grant execute on function public.expirar_assinaturas_vencidas() to service_role;

revoke execute on function public.definir_ciclo_assinatura() from public, anon, authenticated;

revoke execute on function app_private.cancelar_agendamento_cliente(uuid) from public, anon;
grant execute on function app_private.cancelar_agendamento_cliente(uuid) to authenticated;

revoke execute on function app_private.cancelar_corte_plano(uuid) from public, anon;
grant execute on function app_private.cancelar_corte_plano(uuid) to authenticated;

revoke execute on function app_private.confirmar_corte_plano(uuid) from public, anon;
grant execute on function app_private.confirmar_corte_plano(uuid) to authenticated;

revoke execute on function app_private.solicitar_plano_cliente(uuid, text) from public, anon;
grant execute on function app_private.solicitar_plano_cliente(uuid, text) to authenticated;

revoke execute on function app_private.solicitar_mudanca_plano_cliente(uuid, text) from public, anon;
grant execute on function app_private.solicitar_mudanca_plano_cliente(uuid, text) to authenticated;

revoke execute on function app_private.solicitar_upgrade_plano_cliente(uuid, text) from public, anon;
grant execute on function app_private.solicitar_upgrade_plano_cliente(uuid, text) to authenticated;

revoke execute on function app_private.cancelar_mudanca_plano_cliente(uuid) from public, anon;
grant execute on function app_private.cancelar_mudanca_plano_cliente(uuid) to authenticated;

alter table public.agendamentos alter column empresa_id drop default;
alter table public.assinaturas alter column empresa_id drop default;
alter table public.barbeiros alter column empresa_id drop default;
alter table public.clientes alter column empresa_id drop default;
alter table public.configuracoes alter column empresa_id drop default;
alter table public.filiais alter column empresa_id drop default;
alter table public.historico_cortes alter column empresa_id drop default;
alter table public.horarios_funcionamento alter column empresa_id drop default;
alter table public.planos alter column empresa_id drop default;
alter table public.servicos alter column empresa_id drop default;

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
  v_rate_limits_removidos integer := 0;
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

  delete from public.cadastro_rate_limits
  where updated_at < now() - interval '24 hours'
    and (blocked_until is null or blocked_until < now());
  get diagnostics v_rate_limits_removidos = row_count;

  return jsonb_build_object(
    'assinaturas_expiradas', v_assinaturas_expiradas,
    'agendamentos_finalizados', v_agendamentos_finalizados,
    'notificacoes_removidas', v_notificacoes_removidas,
    'cadastro_rate_limits_removidos', v_rate_limits_removidos,
    'executado_em', now()
  );
end;
$function$;

revoke execute on function app_private.executar_manutencao_sistema() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname in (
    'cleanup_notificacoes_antigas',
    'finalizar_agendamentos_vencidos',
    'expirar_assinaturas_vencidas',
    'barbeariaclick-system-maintenance'
  );

  perform cron.schedule(
    'barbeariaclick-system-maintenance',
    '*/5 * * * *',
    'select app_private.executar_manutencao_sistema();'
  );
end;
$$;

drop policy if exists "Admin exclui agendamentos da empresa" on public.agendamentos;

revoke delete, truncate on table public.agendamentos from anon, authenticated;

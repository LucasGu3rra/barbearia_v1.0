do $$
begin
  if to_regclass('public.push_subscriptions') is not null then
    delete from public.push_subscriptions ps
    using (
      select id,
             row_number() over (
               partition by empresa_id, endpoint
               order by enabled desc, updated_at desc, last_seen_at desc, created_at desc, id desc
             ) as rn
      from public.push_subscriptions
    ) duplicadas
    where ps.id = duplicadas.id
      and duplicadas.rn > 1;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.push_subscriptions'::regclass
        and conname = 'push_subscriptions_empresa_id_endpoint_key'
    ) then
      alter table public.push_subscriptions
        add constraint push_subscriptions_empresa_id_endpoint_key unique (empresa_id, endpoint);
    end if;

    drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
    drop policy if exists push_subscriptions_update_same_company_endpoint on public.push_subscriptions;
    create policy push_subscriptions_update_same_company_endpoint
      on public.push_subscriptions
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.usuarios_empresas ue
          where ue.user_id = (select auth.uid())
            and ue.empresa_id = push_subscriptions.empresa_id
        )
      )
      with check (
        user_id = (select auth.uid())
        and exists (
          select 1
          from public.usuarios_empresas ue
          where ue.user_id = (select auth.uid())
            and ue.empresa_id = push_subscriptions.empresa_id
        )
      );
  end if;
end $$;

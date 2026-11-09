create or replace function public.has_role(required_role public.account_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = required_role
  )
  or (
    required_role = 'seller'
    and exists (
      select 1
      from public.profiles
      join public.seller_profiles on seller_profiles.user_id = profiles.id
      join auth.users on auth.users.id = profiles.id
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
        and lower(auth.users.email) = 'muhrizkiakbar239@gmail.com'
    )
  );
$$;

revoke all on function public.has_role(public.account_role) from public;
grant execute on function public.has_role(public.account_role) to anon, authenticated;

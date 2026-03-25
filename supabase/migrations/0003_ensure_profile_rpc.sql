-- Fix login loop: session exists but profiles row missing (trigger skipped / manual user / old accounts)
-- Call from client after sign-in when profiles lookup returns no row.

create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  select
    u.id,
    coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    u.email,
    public.role_from_email(u.email)
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do nothing;
end;
$$;

grant execute on function public.ensure_my_profile() to authenticated;

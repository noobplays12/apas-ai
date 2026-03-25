-- Fix client profile insert: JWT email claim is not always present in RLS the same way as auth.users.
-- BEFORE INSERT trigger (security definer) forces email + role from auth.users — insert policy only needs id = auth.uid().

create or replace function public.profiles_insert_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_email text;
  auth_meta jsonb;
begin
  select u.email, u.raw_user_meta_data into auth_email, auth_meta
  from auth.users u
  where u.id = new.id;

  if auth_email is null then
    raise exception 'no auth user for profile';
  end if;

  new.email := auth_email;
  new.role := public.role_from_email(auth_email);
  if new.name is null or trim(new.name) = '' then
    new.name := coalesce(auth_meta->>'name', split_part(auth_email, '@', 1));
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_insert_from_auth_trg on public.profiles;
create trigger profiles_insert_from_auth_trg
before insert on public.profiles
for each row execute procedure public.profiles_insert_from_auth();

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

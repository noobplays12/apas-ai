-- Allow users to insert only their own profile row, with role/email derived from JWT (no privilege escalation).
-- Used when ensure_my_profile RPC is missing or trigger did not run.

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (
  id = auth.uid()
  and email = (auth.jwt() ->> 'email')
  and role = public.role_from_email(email)
);

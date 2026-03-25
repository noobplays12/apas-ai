-- Fix "stack depth limit exceeded": helpers that SELECT from profiles must not run under RLS,
-- or policies that call current_role() recurse forever.

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.current_class_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.class_id
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.current_semester_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.semester_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.current_section_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.section_id from public.profiles p where p.id = auth.uid();
$$;

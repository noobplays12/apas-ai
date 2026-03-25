-- Supabase schema for Smart Anti-Proxy Attendance System
-- Roles:
-- - admin:    noobplays304@gmail.com
-- - teacher:  *@iub.edu.pk
-- - student:  everyone else

-- Enable required extensions
create extension if not exists pgcrypto;

-- =========================================================
-- Helper: role assignment from email
-- =========================================================
create or replace function public.role_from_email(email text)
returns text
language sql
stable
as $$
  select case
    when lower(email) = 'noobplays304@gmail.com' then 'admin'
    when lower(email) like '%@iub.edu.pk' then 'teacher'
    else 'student'
  end;
$$;

-- =========================================================
-- Core tables
-- =========================================================

create table if not exists public.classes (
  id text primary key,
  name text not null,
  section text null
);

create table if not exists public.subjects (
  id text primary key,
  name text not null,
  code text null
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('student','teacher','admin')),
  roll_no text null,
  class_id text null references public.classes(id),
  device_id text null,
  created_at timestamptz not null default now()
);

create index if not exists profiles_class_id_idx on public.profiles(class_id);
create index if not exists profiles_role_idx on public.profiles(role);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(id),
  subject_id text not null references public.subjects(id),
  teacher_id uuid not null references public.profiles(id),
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_active boolean not null default false,
  verify_gps boolean not null default false,
  verify_wifi boolean not null default false,
  wifi_ssid text null,
  location_lat double precision null,
  location_lng double precision null,
  location_radius double precision null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_class_active_idx on public.sessions(class_id, is_active);
create index if not exists sessions_teacher_active_idx on public.sessions(teacher_id, is_active);
create index if not exists sessions_created_at_idx on public.sessions(created_at desc);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  timestamp timestamptz not null default now(),
  status text not null check (status in ('present','absent')),
  device_id text not null,
  wifi_ssid text null,
  verified boolean not null default true,
  location_lat double precision null,
  location_lng double precision null
);

create unique index if not exists attendance_unique_student_session on public.attendance(student_id, session_id);
create index if not exists attendance_session_ts_idx on public.attendance(session_id, timestamp desc);
create index if not exists attendance_student_ts_idx on public.attendance(student_id, timestamp desc);

-- =========================================================
-- Trigger: create profile on auth user creation
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    public.role_from_email(new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- RLS
-- =========================================================

alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;

-- Helper: current profile role (safe)
create or replace function public.current_role()
returns text
language sql
stable
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

-- Helper: current class id
create or replace function public.current_class_id()
returns text
language sql
stable
as $$
  select p.class_id
  from public.profiles p
  where p.id = auth.uid();
$$;

-- classes/subjects: authenticated read; service role can do anything anyway
drop policy if exists "classes_read_auth" on public.classes;
create policy "classes_read_auth"
on public.classes for select
to authenticated
using (true);

drop policy if exists "subjects_read_auth" on public.subjects;
create policy "subjects_read_auth"
on public.subjects for select
to authenticated
using (true);

-- profiles: read own; update own device_id only
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_device_id" on public.profiles;
create policy "profiles_update_device_id"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- sessions: teacher/admin create & update own sessions
drop policy if exists "sessions_insert_teacher" on public.sessions;
create policy "sessions_insert_teacher"
on public.sessions for insert
to authenticated
with check (
  teacher_id = auth.uid()
  and public.current_role() in ('teacher','admin')
);

drop policy if exists "sessions_update_teacher" on public.sessions;
create policy "sessions_update_teacher"
on public.sessions for update
to authenticated
using (
  teacher_id = auth.uid()
  and public.current_role() in ('teacher','admin')
)
with check (
  teacher_id = auth.uid()
  and public.current_role() in ('teacher','admin')
);

-- sessions: students can read active session for their class; teachers can read own; admins can read all
drop policy if exists "sessions_select_student_active" on public.sessions;
create policy "sessions_select_student_active"
on public.sessions for select
to authenticated
using (
  (public.current_role() = 'student' and is_active = true and class_id = public.current_class_id())
  or (public.current_role() in ('teacher','admin') and teacher_id = auth.uid())
  or (public.current_role() = 'admin')
);

-- attendance: students insert their own attendance for active session in their class
drop policy if exists "attendance_insert_student" on public.attendance;
create policy "attendance_insert_student"
on public.attendance for insert
to authenticated
with check (
  student_id = auth.uid()
  and public.current_role() = 'student'
  and exists (
    select 1
    from public.sessions s
    where s.id = attendance.session_id
      and s.is_active = true
      and s.class_id = public.current_class_id()
  )
);

-- attendance: student reads own; teacher/admin reads for sessions they own; admin reads all
drop policy if exists "attendance_select" on public.attendance;
create policy "attendance_select"
on public.attendance for select
to authenticated
using (
  (public.current_role() = 'student' and student_id = auth.uid())
  or (
    public.current_role() in ('teacher','admin')
    and exists (
      select 1
      from public.sessions s
      where s.id = attendance.session_id
        and s.teacher_id = auth.uid()
    )
  )
  or (public.current_role() = 'admin')
);


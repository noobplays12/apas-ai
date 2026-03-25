-- Departmental scale: semesters, sections, timetable, section rosters, session scoping

-- =========================================================
-- Semesters & sections
-- =========================================================
create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists semesters_name_unique on public.semesters (lower(name));

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  section_name text not null,
  display_label text null,
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness per semester (expressions not allowed in table UNIQUE (...))
create unique index if not exists sections_semester_section_lower_unique
  on public.sections (semester_id, lower(section_name));

create index if not exists sections_semester_id_idx on public.sections(semester_id);

-- Roster rows imported from PDF (may exist before student auth account)
create table if not exists public.section_students (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  roll_no text not null,
  full_name text not null,
  profile_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (section_id, roll_no)
);

create index if not exists section_students_section_idx on public.section_students(section_id);

-- Timetable (teacher → subject → section + time)
create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  subject_id text not null references public.subjects(id),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_label text null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists timetable_teacher_day_idx on public.timetable_slots(teacher_id, day_of_week);
create index if not exists timetable_section_idx on public.timetable_slots(section_id);

-- Import audit logs (optional)
create table if not exists public.import_logs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('section_pdf','timetable')),
  message text not null,
  meta jsonb null,
  created_by uuid null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Profiles: map students to semester/section
alter table public.profiles
  add column if not exists semester_id uuid null references public.semesters(id),
  add column if not exists section_id uuid null references public.sections(id);

create index if not exists profiles_semester_section_idx on public.profiles(semester_id, section_id);

-- Sessions: scope by section (multiple concurrent classes)
alter table public.sessions
  add column if not exists semester_id uuid null references public.semesters(id),
  add column if not exists section_id uuid null references public.sections(id);

-- Allow session without legacy class when semester+section are set
alter table public.sessions alter column class_id drop not null;

alter table public.sessions drop constraint if exists sessions_class_or_section_chk;
alter table public.sessions add constraint sessions_class_or_section_chk check (
  class_id is not null
  or (semester_id is not null and section_id is not null)
);

create index if not exists sessions_section_active_idx on public.sessions(section_id, is_active);
create index if not exists sessions_semester_section_idx on public.sessions(semester_id, section_id);

-- =========================================================
-- Helpers for RLS
-- =========================================================
create or replace function public.current_semester_id()
returns uuid
language sql
stable
as $$
  select p.semester_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.current_section_id()
returns uuid
language sql
stable
as $$
  select p.section_id from public.profiles p where p.id = auth.uid();
$$;

-- =========================================================
-- RLS new tables
-- =========================================================
alter table public.semesters enable row level security;
alter table public.sections enable row level security;
alter table public.section_students enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.import_logs enable row level security;

drop policy if exists "semesters_read_auth" on public.semesters;
create policy "semesters_read_auth"
on public.semesters for select
to authenticated
using (true);

drop policy if exists "semesters_admin_write" on public.semesters;
create policy "semesters_admin_write"
on public.semesters for all
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "sections_read_auth" on public.sections;
create policy "sections_read_auth"
on public.sections for select
to authenticated
using (true);

drop policy if exists "sections_admin_write" on public.sections;
create policy "sections_admin_write"
on public.sections for all
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "section_students_admin_all" on public.section_students;
create policy "section_students_admin_all"
on public.section_students for all
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "section_students_teacher_read" on public.section_students;
create policy "section_students_teacher_read"
on public.section_students for select
to authenticated
using (
  public.current_role() = 'teacher'
  and exists (
    select 1 from public.timetable_slots t
    where t.teacher_id = auth.uid()
      and t.section_id = section_students.section_id
  )
);

drop policy if exists "timetable_read_scope" on public.timetable_slots;
create policy "timetable_read_scope"
on public.timetable_slots for select
to authenticated
using (
  public.current_role() = 'admin'
  or teacher_id = auth.uid()
  or (
    public.current_role() = 'student'
    and semester_id = public.current_semester_id()
    and section_id = public.current_section_id()
  )
);

drop policy if exists "timetable_admin_write" on public.timetable_slots;
create policy "timetable_admin_write"
on public.timetable_slots for all
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "import_logs_admin" on public.import_logs;
create policy "import_logs_admin"
on public.import_logs for select
to authenticated
using (public.current_role() = 'admin');

drop policy if exists "import_logs_admin_insert" on public.import_logs;
create policy "import_logs_admin_insert"
on public.import_logs for insert
to authenticated
with check (public.current_role() = 'admin');

-- =========================================================
-- Extend profiles policies (admin + scoped teacher reads)
-- =========================================================
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
on public.profiles for select
to authenticated
using (public.current_role() = 'admin');

drop policy if exists "profiles_select_teacher_students" on public.profiles;
create policy "profiles_select_teacher_students"
on public.profiles for select
to authenticated
using (
  public.current_role() = 'teacher'
  and profiles.role = 'student'
  and (
    exists (
      select 1 from public.timetable_slots t
      where t.teacher_id = auth.uid()
        and t.section_id = profiles.section_id
    )
    or exists (
      select 1 from public.sessions s
      where s.teacher_id = auth.uid()
        and s.is_active = true
        and profiles.section_id is not null
        and s.section_id = profiles.section_id
    )
    or (
      profiles.class_id is not null
      and exists (
        select 1 from public.sessions s2
        where s2.teacher_id = auth.uid()
          and s2.class_id = profiles.class_id
      )
    )
  )
);

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles for update
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

-- =========================================================
-- Replace session select/insert policies for section-aware students
-- =========================================================
drop policy if exists "sessions_select_student_active" on public.sessions;
create policy "sessions_select_student_active"
on public.sessions for select
to authenticated
using (
  (
    public.current_role() = 'student'
    and is_active = true
    and (
      (
        semester_id is not null
        and section_id is not null
        and semester_id = public.current_semester_id()
        and section_id = public.current_section_id()
      )
      or (
        (semester_id is null or section_id is null)
        and class_id = public.current_class_id()
      )
    )
  )
  or (public.current_role() in ('teacher','admin') and teacher_id = auth.uid())
  or (public.current_role() = 'admin')
);

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
      and (
        (
          s.semester_id is not null
          and s.section_id is not null
          and s.semester_id = public.current_semester_id()
          and s.section_id = public.current_section_id()
        )
        or (
          (s.semester_id is null or s.section_id is null)
          and s.class_id = public.current_class_id()
        )
      )
  )
);

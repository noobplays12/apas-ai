## Supabase setup

### 1) Create project
- Create a new Supabase project in the Supabase dashboard.

### 2) Run migrations
Run the SQL in order:
- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_departmental.sql` (semesters, sections, timetable, multi-session scoping, PDF/Excel imports)

You can run each file in the Supabase SQL editor.

### 3) Enable Realtime (required for live sessions/check-ins)
In Supabase dashboard:
- Go to **Database → Replication**
- Ensure `sessions` and `attendance` are added to the publication used by Realtime.

### 4) Auth providers
Enable **Email / Password** auth in:
- **Authentication → Providers**

### 5) Role rules
Role is assigned automatically when a user signs up:
- **admin**: `noobplays304@gmail.com`
- **teacher**: any email ending with `@iub.edu.pk`
- **student**: everyone else


<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/eabe1d51-1a90-43db-b160-7da15922a375

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create an `.env.local` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (for the Vite client)
3. Run the app:
   `npm run dev`

## Vercel + Supabase

### Environment variables (Vercel)

- **Client (Vite)**:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- **Serverless (API routes)**:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### API routes

- `POST /api/seed` (admin only)
- `POST /api/sessions/start` (teacher/admin)
- `POST /api/sessions/end` (teacher/admin)

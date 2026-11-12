# QuickWork

A workforce booking platform connecting businesses with verified daily-wage workers for short-term employment. Supports job categories including catering, warehousing, logistics, retail, events, and housekeeping.

**Tech Stack**: TanStack Start (React), TypeScript, Tailwind CSS, Supabase (auth + database), Nitro (server)

Built with [Lovable](https://lovable.dev) | **Live app**: https://swift-team-up.lovable.app

---

## Deployment

### Deploy to Vercel

1. **Import your repository** in the [Vercel Dashboard](https://vercel.com/new)

2. **Configure environment variables** (Project Settings → Environment Variables):
   
   Add these variables for **both Production and Preview** environments:
   
   - `VITE_SUPABASE_URL` — Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — Your Supabase anon/public key
   - `NITRO_PRESET` — Set to `vercel`

3. **Deploy** — Vercel will automatically build and deploy your app

### Supabase Setup Checklist

Before your app can work in production, complete these steps in your Supabase project:

#### 1. Authentication Configuration
- [ ] **Enable Email provider** (Supabase Dashboard → Authentication → Providers → Email)
- [ ] **Configure site URL**: Set to your production domain (e.g., `https://your-app.vercel.app`)
- [ ] **Add redirect URLs**: Add your production URL to the allow list
  - Production: `https://your-app.vercel.app/auth-callback`
  - Preview: `https://*.vercel.app/auth-callback` (for preview deployments)

#### 2. Optional: Enable OAuth Providers
- [ ] **Google Sign-In**: Add Client ID & Secret under Authentication → Providers → Google
  - Set authorized redirect: `https://<your-ref>.supabase.co/auth/v1/callback`
- [ ] **Phone/SMS OTP**: Configure SMS provider (Twilio, etc.) under Providers → Phone

#### 3. Database Setup
- [ ] **Run migrations**: Apply the database schema from `supabase/migrations/`
  - Use Supabase CLI: `npx supabase db push`
  - Or manually via SQL Editor in Supabase Dashboard
- [ ] **Verify RLS policies**: Ensure Row Level Security policies are enabled on all tables
- [ ] **Test database connection**: Verify your app can read/write data with the anon key

#### 4. Post-Deployment Verification
- [ ] Test user sign-up and login flows
- [ ] Verify job posting and application workflows
- [ ] Check that RLS policies enforce proper data access
- [ ] Confirm environment variables are set correctly (check Vercel logs if issues)

### Troubleshooting

**Build fails with Supabase errors:**
- Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set for Preview deployments
- Check that `NITRO_PRESET=vercel` is configured

**Auth redirects fail:**
- Verify your production URL is added to Supabase redirect URL allow list
- Check that site URL matches your deployment domain

**Data access errors:**
- Confirm RLS policies are enabled and correctly configured
- Verify your migrations have been applied to the production database

---

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fe749af1-73ec-4344-958c-52f1071d1463).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js 18+ and npm.

```sh
# 1. Install dependencies
npm install

# 2. Configure environment
# Copy .env.local.example to .env.local and set your Supabase credentials:
# VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...

# 3. Apply database migrations
npm run db:push

# 4. Start local development server
npm run dev

# 5. Typecheck & build
npm run typecheck
npm run build
```

### Authentication Providers

- **Email OTP**: Works out of the box with Supabase Auth.
- **Phone OTP**: Configure an SMS provider (e.g. Twilio) under _Supabase Dashboard -> Authentication -> Providers -> Phone_.
- **Google OAuth**: Add your Google Client ID & Secret under _Supabase Dashboard -> Authentication -> Providers -> Google_.

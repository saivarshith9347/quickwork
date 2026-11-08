# QuickWork Connect

Build a web app called "QuickWork" — a smart workforce booking platform 

connecting businesses with verified daily-wage workers for instant, 

short-term employment. Initial focus: catering industry, expandable to 

warehousing, logistics, retail, events, and housekeeping.

DESIGN SYSTEM (strict — use these exact values):

- Primary Orange: #F26B1D

- Deep Orange/Red: #D62E1F  

- Sun Gold accent: #FFB627

- Ink Black (dark bg): #14100E

- Charcoal (dark cards): #221D1A

- Off-White (light bg): #FFF8F1

- Success Green: #2FA84F

- Headings font: Sora (bold weights)

- Body font: Inter

- Border radius: 12-16px, not fully rounded

- Support both LIGHT and DARK mode with a toggle in the top nav 

  (persist user choice). Dark mode = charcoal backgrounds with orange 

  glow accents, not pure black. Light mode = warm off-white, not 

  sterile white.

BRAND FEEL: Bold, energetic, trustworthy — like a modern gig-economy 

app (think Swiggy/Ola-level polish) crossed with a professional 

verification service. Should feel exciting and modern to young users 

(18-30) but instantly trustworthy to business owners.

CORE STRUCTURE:

1. Landing page with a hero section using an orange-to-black gradient 

   mesh background. Headline should communicate speed + trust. Below 

   hero, a clear two-path split: "I'm Hiring" vs "I'm Looking for Work" 

   as two large, distinct cards with hover animations (subtle scale + 

   glow).

2. Navbar: logo left, nav links center, dark/light toggle + Sign In/

   Get Started on right. Sticky on scroll with a subtle blur background.

3. "How It Works" section as a 3-4 step horizontal flow with icons, 

   using bento-grid style cards.

4. "Trust & Verification" section highlighting the Skill Verification 

   Program and Verified Professional Badge — use a badge/shield visual 

   motif with gold accent color.

5. Employer dashboard (basic): post a job (fields: date, time, location, 

   number of workers, wage, facilities), view applicants, job status 

   cards in a bento grid.

6. Worker dashboard (basic): browse job listings as cards (location, 

   wage, date/time, employer rating), one-tap "Book This Job" button, 

   profile section showing Verified Badge status.

7. Footer with simple links, social icons, and brand colors.

INTERACTIONS:

- Buttons: scale up slightly (1.03x) + orange glow shadow on hover, 

  smooth 200ms transitions

- Job cards: subtle lift + shadow on hover

- Badge elements: small bounce-in animation on load

- Use skeleton loading states, not spinners, for any data-loading areas

- Smooth page transitions, no jarring jumps

NAVIGATION: Keep it extremely simple — max 4-5 nav items. Every action 

should be reachable in 2 clicks max from home. Avoid clutter; this app 

will be used by people with varying smartphone literacy, so clarity 

beats cleverness.

Do not use generic default Tailwind/shadcn styling untouched — 

customize colors, shadows, and spacing to match the brand system above 

so it doesn't look like a template.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://swift-team-up.lovable.app

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
- **Phone OTP**: Configure an SMS provider (e.g. Twilio) under *Supabase Dashboard -> Authentication -> Providers -> Phone*.
- **Google OAuth**: Add your Google Client ID & Secret under *Supabase Dashboard -> Authentication -> Providers -> Google*.

# QuickVote

Real-time polling app for meetings, classrooms, and presentations. An admin creates a session, participants join by scanning a QR code or following a link, and everyone votes on questions in real time. Results display live on the admin's projected screen.

## Features

- **Live voting sessions** -- create a session, add questions, and control the flow from an admin dashboard
- **QR code join** -- participants scan a QR code or tap a link to join instantly on their phones
- **Agree/Disagree and Multiple Choice** -- two question types with up to 10 options for multiple choice
- **Batch questions** -- group questions into batches for participants to answer all at once via swipeable carousel
- **Real-time results** -- bar charts update live as votes come in, sized for projection in large rooms
- **Presentation mode** -- dedicated projection window with slides, live results, QR overlays, and keyboard navigation
- **Team-based voting** -- divide participants into up to 5 teams; filter results by team on the projected display
- **Visual template editor** -- drag-and-drop session builder with batch/question editing and 3-view preview
- **Participant reasons** -- optionally let voters explain their choice; reasons display grouped under each vote column
- **On-the-fly questions** -- type and launch a quick question mid-session without pre-planning
- **Session templates** -- save full session blueprints (batches, slides, questions) and reload them into new sessions
- **Import/export** -- export sessions to JSON with full fidelity (votes, templates, slides, teams); import into new sessions
- **Past sessions** -- resume a draft session or clone a past session's questions into a new one
- **Admin password gate** -- optionally protect admin pages with a password (set via environment variable)
- **Anonymous or named voting** -- toggle per question whether voter names are visible
- **Countdown timers** -- set a timer on any question to keep things moving
- **Drag-and-drop ordering** -- reorder questions, batches, and slides with drag handles; multi-select with Ctrl+Click
- **Mobile-first participant UI** -- full-screen voting with haptic feedback and slide transitions

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, Motion (Framer Motion)
- **Backend:** Supabase (PostgreSQL, Realtime, anonymous auth)
- **State:** Zustand
- **Routing:** React Router 7
- **Build:** Vite
- **Hosting:** Vercel

## Documentation

- [User Journeys](https://caseyram.github.io/quick-vote/user-journeys.html) — Critical user flows
- [Architecture](https://caseyram.github.io/quick-vote/architecture.html) — Technical design
- [Threat Model](https://caseyram.github.io/quick-vote/threat-model.html) — Security analysis
- [Test Coverage](https://caseyram.github.io/quick-vote/coverage.html) — Coverage report

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Supabase](https://supabase.com/) account and project (see setup below)

### Steps

1. Clone the repo:

   ```
   git clone https://github.com/caseyram/quick-vote.git
   cd quick-vote
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Create your environment file:

   ```
   cp .env.example .env.local
   ```

4. Fill in `.env.local` with your Supabase credentials (see Supabase Setup below):

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   VITE_ADMIN_PASSWORD=
   ```

   `VITE_ADMIN_PASSWORD` is optional. Leave it blank to skip the password gate, or set a value to require a password on admin pages.

5. Start the dev server:

   ```
   npm run dev
   ```

   The app runs at `http://localhost:5173`.

### Other Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Type-check and production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

## Supabase Setup

You need a Supabase project to provide the database, authentication, and real-time features.

### 1. Create an account and project

- Sign up at [supabase.com](https://supabase.com/) ([getting started guide](https://supabase.com/docs/guides/getting-started))
- Create a new project. Choose any region and set a database password.

### 2. Get your API credentials

- Go to **Project Settings > API** in the Supabase dashboard
- Copy the **Project URL** and **anon/public** key into your `.env.local` file

### 3. Run the SQL migrations

Open the **SQL Editor** in your Supabase dashboard and run each migration file from the `supabase/migrations/` folder in order:

| Order | File | What it does |
|-------|------|-------------|
| 1 | `20250101_001_schema.sql` | Core tables (sessions, questions, votes) with indexes and RLS |
| 2 | `20250101_002_moddatetime_trigger.sql` | Auto-update `updated_at` on votes |
| 3 | `20250101_003_realtime_publication.sql` | Enable Realtime on votes and questions |
| 4 | `20250101_004_add_reasons.sql` | Add `reasons_enabled` and `reason` columns |
| 5 | `20250101_005_add_batches.sql` | Batches table for grouping questions |
| 6 | `20250101_006_add_batch_status.sql` | Batch status column |
| 7 | `20250101_008_test_vote_generator.sql` | Test data generation function |
| 8 | `20250101_009_add_test_mode.sql` | Test mode toggle on sessions |
| 9 | `20250129_007_add_timer_expires_at.sql` | Timer expiration tracking |
| 10 | `20250209_010_response_templates.sql` | Response templates table + RLS |
| 11 | `20250209_020_session_default_template.sql` | Default template for sessions |
| 12 | `20250210_030_session_items.sql` | Unified sequence table (batch + slide) + Storage |
| 13 | `20250211_040_claim_session.sql` | Session reclaim logic |
| 14 | `20250211_050_session_templates.sql` | Full session blueprints + RLS |
| 15 | `20250212_060_template_image_storage.sql` | Storage bucket for template images |
| 16 | `20260213_070_batch_cover_images.sql` | Batch cover image support |
| 17 | `20260215_080_add_teams.sql` | Teams array on sessions, team_id on votes |
| 18 | `20260215_090_test_votes_teams.sql` | Test helpers for team voting |

Paste the contents of each file into the SQL Editor and click **Run**.

### 4. Enable anonymous authentication

QuickVote uses anonymous auth so participants can vote without signing up.

- Go to **Authentication > Providers** in your Supabase dashboard
- Enable **Anonymous Sign-Ins** ([Supabase anonymous auth docs](https://supabase.com/docs/guides/auth/auth-anonymous))

### 5. Enable Realtime

- Go to **Database > Replication** in your Supabase dashboard
- Make sure the `supabase_realtime` publication exists and includes the `votes` and `questions` tables
- The `sql/realtime-publication.sql` script handles this, but you can verify it here

## Vercel Deployment

### 1. Create an account

- Sign up at [vercel.com](https://vercel.com/) ([Vercel docs](https://vercel.com/docs))

### 2. Import the project

- Click **Add New > Project** in the Vercel dashboard
- Connect your GitHub account and select the `quick-vote` repository
- Vercel auto-detects the Vite framework

### 3. Set environment variables

In the Vercel project settings under **Settings > Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `VITE_ADMIN_PASSWORD` | (optional) Password to protect admin pages |

### 4. Deploy

Click **Deploy**. Vercel builds and deploys automatically on every push to `main`.

The included `vercel.json` rewrites all routes to `index.html` so client-side routing works correctly.

## Project Structure

```
src/
  components/        UI components (voting, admin, presentation, teams, editor)
  components/editor/ Template editor components (batch editor, sidebar, preview)
  hooks/             Custom hooks (realtime, countdown, haptic, multi-select)
  lib/               Supabase client, vote aggregation, team API, import/export
  pages/             Route pages (Home, AdminSession, ParticipantSession, PresentationView, TemplateEditorPage)
  stores/            Zustand state stores (session, templates, editor)
  types/             TypeScript type definitions
supabase/
  migrations/        Database migration scripts (18 files)
```

## License

MIT + Commons Clause. Free to use, not for sale. See [LICENSE.md](LICENSE.md).

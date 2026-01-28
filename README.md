# QuickVote

Real-time polling app for meetings, classrooms, and presentations. An admin creates a session, participants join by scanning a QR code or following a link, and everyone votes on questions in real time. Results display live on the admin's projected screen.

## Features

- **Live voting sessions** -- create a session, add questions, and control the flow from an admin dashboard
- **QR code join** -- participants scan a QR code or tap a link to join instantly on their phones
- **Agree/Disagree and Multiple Choice** -- two question types with up to 10 options for multiple choice
- **Real-time results** -- bar charts update live as votes come in, sized for projection in large rooms
- **Participant reasons** -- optionally let voters explain their choice; reasons display grouped under each vote column
- **On-the-fly questions** -- type and launch a quick question mid-session without pre-planning
- **Templates** -- save question sets as reusable templates, or import/export as JSON
- **Past sessions** -- resume a draft session or clone a past session's questions into a new one
- **Admin password gate** -- optionally protect admin pages with a password (set via environment variable)
- **Anonymous or named voting** -- toggle per question whether voter names are visible
- **Countdown timers** -- set a timer on any question to keep things moving
- **Mobile-first participant UI** -- full-screen voting with haptic feedback and slide transitions

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, Motion (Framer Motion)
- **Backend:** Supabase (PostgreSQL, Realtime, anonymous auth)
- **State:** Zustand
- **Routing:** React Router 7
- **Build:** Vite
- **Hosting:** Vercel

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

Open the **SQL Editor** in your Supabase dashboard and run each file from the `sql/` folder in this order:

| Order | File | What it does |
|-------|------|-------------|
| 1 | `sql/schema.sql` | Creates the sessions, questions, and votes tables with indexes and Row Level Security policies |
| 2 | `sql/moddatetime-trigger.sql` | Adds a trigger to auto-update the `updated_at` timestamp on votes |
| 3 | `sql/realtime-publication.sql` | Enables real-time Postgres Changes on the votes and questions tables |
| 4 | `sql/add-reasons.sql` | Adds the `reasons_enabled` column to sessions and `reason` column to votes |

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
  components/   UI components (BarChart, QRCode, VoteAgreeDisagree, etc.)
  hooks/        Custom hooks (haptic feedback, realtime, countdown)
  lib/          Supabase client, vote aggregation, template utilities
  pages/        Route pages (Home, AdminSession, ParticipantSession)
  stores/       Zustand state stores
  types/        TypeScript type definitions
sql/            Database migration scripts
```

## License

MIT + Commons Clause. Free to use, not for sale. See [LICENSE.md](LICENSE.md).

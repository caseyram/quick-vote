# Technology Stack

**Project:** QuickVote
**Researched:** 2026-01-27
**Overall confidence:** MEDIUM - All recommendations are based on training data (cutoff May 2025). Exact version numbers should be verified at install time by running `npm create vite@latest` and checking `npm view <package> version` for each dependency. The library choices and architectural rationale are HIGH confidence; exact semver is MEDIUM.

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React | ^19.x | UI framework | Project constraint. React 19 is stable with improved concurrent features, `use()` hook, and server component foundations. For this client-heavy realtime app, React 19's transition APIs help keep the UI responsive during vote floods. | HIGH (choice), MEDIUM (version) |
| Vite | ^6.x | Build tool / dev server | Project constraint. Vite 6 provides sub-second HMR, native ESM dev, and optimized production builds. The React plugin handles JSX/TSX transformation with SWC for speed. | HIGH (choice), MEDIUM (version) |
| TypeScript | ^5.7+ | Type safety | Essential for a multi-component realtime app. Supabase generates TypeScript types from your database schema (`supabase gen types typescript`), giving end-to-end type safety from DB to UI. | HIGH |
| @vitejs/plugin-react | ^4.x | Vite React integration | Official Vite plugin for React. Uses SWC for fast refresh in dev. Install alongside Vite. | HIGH |

### Backend / Database

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Supabase (hosted) | N/A | Database + Realtime + Auth (future) | Project constraint. Supabase provides PostgreSQL, Realtime subscriptions via WebSocket, Row Level Security, and Edge Functions -- everything QuickVote needs without a custom backend. | HIGH |
| @supabase/supabase-js | ^2.x | Supabase client SDK | The official JS client. Provides typed database queries, realtime channel subscriptions (`channel().on('postgres_changes', ...)`), and storage access. v2 is the stable line with full Realtime v2 support including Broadcast and Presence. | HIGH (choice), MEDIUM (version -- check if v3 has shipped) |

**Important Supabase note:** Check whether `@supabase/supabase-js` v3 has been released by the time you install. If v3 is available and stable, prefer it. The API surface is similar but may have breaking changes in channel subscription syntax. Verify with `npm view @supabase/supabase-js version`.

### Styling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tailwind CSS | ^4.x | Utility-first CSS | Tailwind v4 (released early 2025) is a significant rewrite: zero-config by default, CSS-first configuration (no `tailwind.config.js` needed), automatic content detection, and native CSS cascade layers. For QuickVote's tactile UI, Tailwind provides rapid iteration on responsive layouts, animation utilities, and consistent design tokens. | HIGH (choice), MEDIUM (version) |
| @tailwindcss/vite | ^4.x | Tailwind Vite plugin | Tailwind v4 ships its own Vite plugin for optimal integration. Replaces the PostCSS-based setup from v3. Install this instead of configuring PostCSS manually. | MEDIUM |

**Why not CSS-in-JS (styled-components, Emotion)?** Tailwind produces smaller bundles, has zero runtime cost, and is the dominant styling approach in the React + Vite ecosystem. CSS-in-JS adds runtime overhead that hurts mobile performance -- exactly where QuickVote participants will be.

**Why not a component library (MUI, Chakra, shadcn/ui)?** QuickVote's UI is intentionally custom and "immersive" -- full-screen takeovers, large tactile buttons, satisfying animations. A component library would fight against this vision. Tailwind gives full control. If you find yourself needing accessible primitives (dialogs, tooltips), consider Radix UI Primitives (headless, unstyled) rather than a full component library.

### Routing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| react-router | ^7.x | Client-side routing | React Router v7 (the successor to both React Router v6 and Remix) is the standard. QuickVote needs routes for: admin session management, participant voting view, results display, and QR landing pages. React Router v7 provides nested layouts, loaders, and URL-based state. | HIGH (choice), MEDIUM (version) |

**Route structure preview:**
```
/                          -> Landing / create session
/s/:sessionId/admin        -> Admin dashboard for session
/s/:sessionId/admin/results -> Results view (projectable)
/s/:sessionId              -> Participant entry (QR target)
/s/:sessionId/vote         -> Active voting UI
/s/:sessionId/lobby        -> Waiting screen
```

**Why not TanStack Router?** TanStack Router is excellent and fully type-safe. However, React Router v7 is more mature, has a larger ecosystem, and the type-safety gap has narrowed significantly. For QuickVote's straightforward routing needs, React Router v7 is the pragmatic choice. Either would work.

### State Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Zustand | ^5.x | Client-side state | Lightweight (1KB), minimal boilerplate, works naturally with React. For QuickVote: current session state, active question, vote selections, UI mode. Zustand stores are plain functions -- easy to test and reason about. | HIGH (choice), MEDIUM (version -- verify if v5 is stable, may still be v4.x) |

**Why Zustand over alternatives:**
- **Over Redux Toolkit:** Overkill for this app's state complexity. QuickVote's state is mostly server-driven (Supabase realtime) with thin client state.
- **Over Jotai/Recoil:** Zustand's store-based model fits better when you have a few well-defined state slices (session, voting, UI) rather than many atomic values.
- **Over React Context alone:** Context causes re-renders for all consumers on any change. Zustand has built-in selector-based subscriptions, critical when 50+ participants are receiving realtime vote updates.

**Key stores:**
```typescript
// Session store - current session data, questions, settings
useSessionStore()

// Voting store - current question, user's vote, lock status
useVotingStore()

// Realtime store - connection status, participant count
useRealtimeStore()
```

### Realtime Communication

QuickVote's realtime needs are served entirely by Supabase Realtime. No additional WebSocket library needed.

| Technology | Purpose | Why |
|------------|---------|-----|
| Supabase Realtime (Broadcast) | Push vote updates, question changes to all participants | Broadcast channels are pub/sub with no database writes. Ideal for ephemeral events like "admin advanced to next question" or "vote count updated." Scales to hundreds of concurrent subscribers per channel. |
| Supabase Realtime (Postgres Changes) | Sync persistent state changes | Listen to INSERT/UPDATE on `votes`, `questions`, `sessions` tables. Provides eventual consistency -- when a vote is written to the DB, all subscribers get notified. |
| Supabase Realtime (Presence) | Track who's in the session | Shows participant count, who's online. Built into Supabase channels. |

**Why not Socket.IO / Pusher / Ably?** Supabase Realtime is already included in the stack. Adding a separate realtime service creates two WebSocket connections, two auth systems, and deployment complexity. Supabase Realtime's Broadcast + Presence covers QuickVote's needs at v1 scale (50-100 users) without additional infrastructure.

**Scaling note:** If QuickVote grows beyond ~500 concurrent users per session, Supabase Realtime's Broadcast may need evaluation. But at v1 scale (50-100), it's well within limits.

### Charts / Data Visualization

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Recharts | ^2.x | Vote result charts | Built on React + D3, declarative API, responsive out of the box. QuickVote needs bar charts (vote counts), pie charts (vote distribution), and potentially animated transitions as votes come in. Recharts handles all of these with `<BarChart>`, `<PieChart>`, and built-in animation props. | HIGH |

**Why Recharts over alternatives:**
- **Over Chart.js (react-chartjs-2):** Chart.js uses Canvas rendering, which makes it harder to style with Tailwind and integrate with React's component model. Recharts uses SVG, so every element is a DOM node you can style and animate.
- **Over Victory:** Similar capabilities but Recharts has larger community and better docs.
- **Over D3 directly:** Way too low-level for this use case. Recharts provides the right abstraction.
- **Over Nivo:** Excellent library but heavier. Recharts is sufficient for QuickVote's chart types.

**Animated vote counting:** Recharts supports `isAnimationActive` and custom animation duration. Combine with Supabase Realtime updates for live-updating charts as votes arrive.

### Animation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| motion (formerly framer-motion) | ^11.x or ^12.x | UI animations | The project explicitly calls for "satisfying animations" and "immersive tactile" feel. Motion provides layout animations, gesture support, exit animations, and spring physics. Essential for: vote button press feedback, results reveal transitions, question card transitions, lock-in confirmation. | HIGH (choice), MEDIUM (version -- package may be `motion` or `framer-motion`, check npm) |

**Package name note:** Framer Motion was renamed to `motion` (the package). As of early 2025, `motion` is the new package name. Verify at install time: try `npm view motion version`. If not available or outdated, use `framer-motion`.

**Why not CSS animations alone?** CSS handles simple transitions but QuickVote needs:
- Layout animations (elements moving as votes come in)
- Gesture-driven animations (swipe to vote, press and hold)
- Coordinated sequences (vote -> lock-in -> reveal)
- Spring physics (natural feel on mobile tap)

These require a JS animation library. Motion is the standard for React.

**Why not React Spring?** React Spring is excellent for spring physics but has a steeper API learning curve. Motion's declarative API (`animate`, `exit`, `whileTap`) maps directly to QuickVote's needs.

### QR Code Generation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| qrcode.react | ^4.x | QR code rendering | Pure React component, renders QR codes as SVG (scalable, crisp on projectors) or Canvas. Lightweight, well-maintained, 2M+ weekly npm downloads. Admin generates QR code containing the session join URL. | HIGH (choice), MEDIUM (version) |

**Why not react-qr-code?** Both work. `qrcode.react` has higher adoption and supports both SVG and Canvas output. SVG output is important for QuickVote because the QR code will be displayed on projectors/large screens where vector rendering stays crisp.

### Unique ID Generation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| nanoid | ^5.x | Session IDs, participant tokens | Generates URL-friendly unique IDs. Session URLs like `/s/V1StGXR8_Z5jdHi6B-myT` are cleaner than UUIDs. Cryptographically strong, tiny (130 bytes), no dependencies. | HIGH |

**Why not UUID?** UUIDs are 36 characters with hyphens -- ugly in URLs. Nanoid generates 21-character URL-safe IDs by default with the same collision resistance. For a QR-code-driven app, shorter URLs matter.

**Why not Supabase-generated UUIDs?** Supabase auto-generates UUIDs for primary keys, and that's fine for database PKs. But for the user-facing session code (what goes in the URL and QR code), use nanoid for a friendlier format. You can store both: a UUID PK and a nanoid `session_code` column.

### Dev Dependencies

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ESLint | ^9.x | Linting | ESLint 9 uses flat config format. Catches bugs, enforces consistency. | HIGH |
| eslint-config-react-app or @eslint/js + typescript-eslint | latest | ESLint config | Provides sensible defaults for React + TypeScript. | MEDIUM |
| Prettier | ^3.x | Code formatting | Consistent formatting, no debates. Configure with Tailwind plugin for class sorting. | HIGH |
| prettier-plugin-tailwindcss | latest | Tailwind class sorting | Automatically sorts Tailwind classes in a consistent order. Eliminates class ordering bikeshedding. | HIGH |
| supabase (CLI) | latest | Local dev, type generation, migrations | `supabase gen types typescript` generates TypeScript types from your DB schema. `supabase start` runs a local Supabase instance for development. Essential for the workflow. | HIGH |

## What NOT to Use (and Why)

| Technology | Why Not | Use Instead |
|------------|---------|-------------|
| Next.js | QuickVote is a client-heavy SPA. SSR adds complexity without clear benefit -- voting UI is entirely client-rendered, no SEO needed. Vite + React SPA deployed to Vercel is simpler and sufficient. | Vite + React SPA |
| Redux / Redux Toolkit | Overkill state management for an app where most state lives in Supabase. Adds boilerplate for minimal benefit. | Zustand |
| Socket.IO / Pusher | Redundant. Supabase Realtime already provides WebSocket channels with Broadcast, Presence, and Postgres Changes. Adding a second realtime service doubles complexity. | Supabase Realtime |
| Firebase | Project constraint is Supabase. Also, Supabase's Postgres foundation is more flexible for complex queries (e.g., aggregating vote results with SQL). | Supabase |
| Material UI / Chakra UI | QuickVote's UI is intentionally custom and immersive. Component libraries impose design constraints that conflict with the "not a sterile form" vision. | Tailwind CSS + Radix Primitives (if needed) |
| Axios | Modern `fetch` is sufficient. Supabase client handles all API calls. No need for an HTTP client library. | Native fetch / Supabase client |
| styled-components / Emotion | Runtime CSS-in-JS has performance cost on mobile. Tailwind provides utility classes with zero runtime. | Tailwind CSS |
| Formik / React Hook Form | QuickVote has minimal forms (admin creating questions). React's built-in form handling + controlled components is sufficient. | Native React forms |
| moment.js / date-fns | QuickVote's date needs are minimal (session timestamps). Use native `Intl.DateTimeFormat` and `Date`. | Native APIs |

## Alternatives Considered (Deeper Analysis)

### State Management: Zustand vs. Jotai vs. Context

| Criterion | Zustand | Jotai | React Context |
|-----------|---------|-------|---------------|
| Bundle size | ~1KB | ~2KB | 0KB (built-in) |
| Re-render control | Selector-based (fine) | Atom-based (fine) | All consumers re-render |
| Learning curve | Very low | Low | Zero |
| DevTools | Yes (middleware) | Yes | React DevTools |
| Best for | Few stores, clear slices | Many independent atoms | Simple, infrequent updates |

**Verdict:** Zustand. QuickVote has 3-4 well-defined state slices. Zustand's store model is a natural fit. Context would cause unnecessary re-renders when vote counts update rapidly.

### Charts: Recharts vs. Chart.js vs. Nivo

| Criterion | Recharts | Chart.js | Nivo |
|-----------|----------|----------|------|
| Rendering | SVG | Canvas | SVG |
| React integration | Native components | Wrapper (react-chartjs-2) | Native components |
| Bundle size | ~140KB | ~60KB | ~200KB+ |
| Animation | Built-in, configurable | Built-in | Built-in |
| Tailwind compat | Easy (SVG = DOM) | Hard (Canvas) | Easy (SVG = DOM) |
| Responsiveness | Built-in | Requires config | Built-in |

**Verdict:** Recharts. SVG rendering integrates naturally with React and Tailwind. The bundle size premium over Chart.js is worth the better DX and styling flexibility.

### Animation: Motion vs. React Spring vs. CSS

| Criterion | Motion | React Spring | CSS Only |
|-----------|--------|--------------|----------|
| Gesture support | Excellent (whileTap, drag) | Limited | None |
| Layout animation | Yes (layoutId) | No | Limited |
| Exit animations | Yes (AnimatePresence) | Yes (useTransition) | No |
| Spring physics | Yes | Yes (core strength) | Limited |
| API ergonomics | Declarative, intuitive | Hooks-based, steeper | Native |
| Bundle | ~30KB | ~20KB | 0KB |

**Verdict:** Motion. The gesture support (`whileTap`, `whileHover`, `drag`) is essential for the tactile voting UI. Layout animations make results charts feel alive as votes arrive. Exit animations via `AnimatePresence` handle question transitions cleanly.

## Installation Commands

**Note:** Verify all versions at install time. These commands use `@latest` where exact versions are uncertain.

```bash
# Initialize project
npm create vite@latest quick-vote -- --template react-ts
cd quick-vote

# Core dependencies
npm install @supabase/supabase-js react-router recharts motion qrcode.react zustand nanoid

# Styling
npm install tailwindcss @tailwindcss/vite

# Dev dependencies
npm install -D supabase typescript @types/react @types/react-dom
npm install -D eslint prettier prettier-plugin-tailwindcss

# Generate Supabase types (after setting up schema)
npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
```

## Deployment: Vercel

QuickVote is a Vite SPA deployed to Vercel. Configuration is minimal:

```json
// vercel.json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Why the rewrite rule?** SPA routing -- all paths should serve `index.html` and let React Router handle routing client-side. Without this, refreshing on `/s/abc123/vote` would 404.

**Environment variables on Vercel:**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Note:** The anon key is safe to expose in client-side code. It's designed for this -- Row Level Security policies in Supabase control access, not the key itself.

## Version Verification Checklist

Before starting development, run these commands to confirm you have current versions:

```bash
npm view vite version
npm view react version
npm view @supabase/supabase-js version
npm view react-router version
npm view recharts version
npm view motion version         # If not found, use framer-motion
npm view zustand version
npm view tailwindcss version
npm view qrcode.react version
npm view nanoid version
```

Update the versions in `package.json` if any have moved to a new major version since this research was written.

## Sources and Confidence

| Recommendation | Source | Confidence |
|----------------|--------|------------|
| React 19, Vite 6, TypeScript 5.7+ | Training data (May 2025) | MEDIUM -- versions likely correct but verify |
| Supabase JS v2 | Training data | MEDIUM -- v3 may have shipped, check |
| Tailwind v4 | Training data (shipped Feb 2025) | HIGH -- major release, well documented |
| Zustand | Training data | HIGH -- stable, mature library |
| Recharts, Motion, qrcode.react, nanoid | Training data | HIGH -- library choices are sound, versions approximate |
| React Router v7 | Training data (shipped late 2024) | HIGH -- well established |
| "Don't use Next.js" rationale | Training data + project analysis | HIGH -- sound architectural reasoning for this SPA |
| Supabase Realtime capabilities | Training data | HIGH -- core Supabase feature, well documented |
| Deployment config | Training data | HIGH -- standard Vercel SPA pattern |

**Key verification actions needed:**
1. Check if `motion` or `framer-motion` is the correct npm package name
2. Check if `@supabase/supabase-js` v3 has been released
3. Confirm Tailwind v4's Vite plugin package name (`@tailwindcss/vite`)
4. Verify React Router v7 import patterns (may use `react-router` instead of `react-router-dom`)

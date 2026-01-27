# Phase 1: Integration Spike - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove the full deployment pipeline end-to-end before any feature work begins. Scaffold a Vite+React+TypeScript project, connect it to Supabase, deploy to Vercel, and validate that both Supabase Broadcast and Postgres Changes realtime mechanisms work. No feature code — just infrastructure validation.

</domain>

<decisions>
## Implementation Decisions

### Supabase project setup
- User has an existing Supabase account — create a new project for QuickVote
- Free tier for now (development and v1 validation)
- Host in US East region (closest to Vercel edge nodes)
- Dashboard-only management — no Supabase CLI or local Docker setup
- Schema changes managed through Supabase web dashboard, not migration files

### Vercel deployment config
- User has an existing Vercel account
- Use default Vercel URL (project-name.vercel.app) — no custom domain yet
- Auto-deploy on push to main branch
- Preview deployments enabled for branches/PRs
- Environment variables configured in Vercel dashboard (SUPABASE_URL, SUPABASE_ANON_KEY)

### Realtime proof-of-concept
- Must prove BOTH Supabase Realtime mechanisms:
  1. Broadcast (pub/sub): One browser tab sends a message, another receives it instantly
  2. Postgres Changes (DB-driven): Write to a test table, see the change appear in another tab via subscription
- This validates the two patterns that Phase 4 will rely on heavily

### Claude's Discretion
- Whether the PoC is a visible /demo page or dev-only /test route
- Whether to keep PoC code as reference or clean it up after validation
- Project folder structure and naming conventions
- Which test table schema to use for the Postgres Changes PoC

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The key outcome is confidence that Supabase Realtime works as expected on the free tier deployed to Vercel, before building features on top of it.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-integration-spike*
*Context gathered: 2026-01-27*

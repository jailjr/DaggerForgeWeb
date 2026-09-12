# Architecture notes

## Current slice

The app is a Vite + React + TypeScript single-page client. `src/main.tsx` owns the seeded demo campaign and renders the GM workspace. `src/styles.css` contains the responsive visual system. The demo is intentionally dependency-light and stores only campaign demo state in localStorage; a BroadcastChannel sends character projection updates to other open tabs without broadcasting private notes.

## Domain boundaries

`src/content/daggerforge/` is immutable imported base content. It is isolated from campaign/runtime state so an upstream refresh can replace that directory without changing campaign records. Custom records should be stored separately and reference a `source` of `daggerforge` or `custom`.

`src/domain/rules.ts` is the authority seam. The future API must call the same rules server-side; UI disabling is never sufficient authorization.

## Required persistence model

Campaigns, participants, characters, character_runtime, inventories, library_definitions, runtime_instances, encounters, sessions, announcements, audit_events, access_grants, and exports should use UUID primary keys, campaign foreign keys, timestamps, `version` integers, and archive flags. Audit events keep actor ID, nickname snapshot, operation, entity/field, previous/new values, and session ID. Access/security logs remain separate from gameplay history.

## Access and privacy

GM access is a signed private token held in an HttpOnly, Secure, SameSite cookie. Player join uses a campaign grant token, creates a UUID participant, and stores only a participant cookie. Token hashes—not raw tokens—are stored. Rate limit join attempts and revoke grants. Player projections exclude GM Library, GM notes, other full character sheets, and private character notes. Realtime topics are campaign-scoped and field-filtered.

## Realtime and concurrency

Use a small WebSocket/SSE service or the database provider's free realtime feature for row-level events. Every mutation carries `expectedVersion`; conflicting writes return `409` with a refreshable conflict state. Undo is a new mutation that checks the current version and never deletes the original event.

## Deployment

The static client can deploy to Cloudflare Pages or GitHub Pages with HTTPS and GitHub Actions. A production API/database can use a free Supabase/Neon project with provider backups and a versioned migration directory. No deployment was claimed here because no provider credentials were available in the workspace. Before launch, configure secrets, run migrations, enable backups, and add a smoke test to the deployment job.

## Deliberate demo limitations

The checked-in demo does not claim production authentication, server-side isolation, cloud object storage, provider backups, or remote deployment. Those are documented seams rather than simulated security. The frontend does include the permission/concurrency primitives and a realistic seeded workflow so the product can be evaluated and extended safely.

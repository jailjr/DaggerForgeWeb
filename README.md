# DaggerForge Web

DaggerForge Web is a responsive campaign workspace for playing Daggerheart online. It is grounded in the upstream [Torutu/daggerforge](https://github.com/Torutu/daggerforge) project: its character vocabulary, HP/Hope/Stress/Armor tracks, inventory patterns, adversary/environment/item content, and GM library concepts are preserved while the presentation is adapted for a shared web table.

## Run locally

Prerequisite: Node.js 14.17+ (the current workspace runtime). Then:

```bash
npm install
npm run dev
```

If the bundled Windows npm launcher reports `EEXIST` while creating its global npm directory, use `start-dev.cmd` (or run `node node_modules/vite/bin/vite.js --host 127.0.0.1`) instead. This is an environment-level npm wrapper issue; Vite itself starts normally.

Open `http://localhost:5173`. The demo campaign is seeded in the client and persisted in localStorage. Open a second tab to exercise the BroadcastChannel realtime demo, then change HP/Hope/Stress in the Characters or Table View screens.

Build and tests:

```bash
npm run build
npm test
```

## What is included

- Preparation ↔ Play mode shell, warnings/complete states, responsive desktop/tablet/mobile layout, dark/light theme.
- Campaign overview, roster, Daggerheart-style character sheet, runtime resource tracks, inventory/equipment, private notes indicator, table view, adversaries, sessions, announcements-ready activity feed, GM library, and dense Event Console.
- Demo persistence and cross-tab realtime synchronization with meaningful audit entries.
- A server-side rule module for the eventual API boundary covering player/GM edit authority and atomic character claiming.
- A runnable local API at `server/index.js` with campaign creation, participant joins, token-scoped projections, GM-only Event Console data, versioned character mutations, mode changes, and SSE updates. Start it with `node server/index.js` or `npm run api`; it listens on `http://127.0.0.1:8787`.
- Imported upstream base content isolated under `src/content/daggerforge/` (SRD JSON, adversaries, environments, items, and MIT notice). Base files are not mutated by campaign state.

## Architecture and production path

The current deliverable includes a runnable frontend and a local persistent API adapter. The adapter uses a JSON file for development; production should replace that repository with Postgres (Neon/Supabase free tier), signed campaign/GM tokens, participant cookies, row-version optimistic concurrency, append-only audit events, and WebSocket/SSE subscriptions. Store avatars in provider object storage, never in normal rows. The browser demo still uses localStorage by default so it runs without accounts or cloud credentials; the API can be exercised independently for integration work.

The API should expose only campaign-scoped projections: players receive their own complete character, explicitly shared table state, and no GM library/private notes. Use a transaction for character claims (`UPDATE ... WHERE owner_id IS NULL`), version checks for edits and undo, and archive semantics for characters. Import should validate a versioned JSON export and always create a new campaign.

## Daggerforge attribution

The upstream project is MIT licensed by Waleed Alnaimi; the license is preserved at `src/content/daggerforge/LICENSE`. The upstream README also attributes Daggerheart System Reference Document 1.0 materials to Critical Role, LLC under the Darrington Press Community Gaming License. See `docs/ARCHITECTURE.md` for the update/import boundary.

# Decisions

One line per decision: date, decision, reason.

- 2026-09-12 — Stack per CLAUDE.md defaults: Vite + React + TS, Zustand store, Dexie (IndexedDB), vite-plugin-pwa, GitHub Pages. No deviation yet.
- 2026-09-12 — Phase 1 is local-only; Supabase not touched until Phase 1 passes the §11 acceptance test.
- 2026-09-12 — Play participants are embedded on the Play row locally (not a separate PlayParticipant table). One atomic write per play; flatten for Supabase in Phase 2.
- 2026-09-12 — Sideline UI state (field selection, play type, possession) is persisted per game in a `gameUi` table so a mid-game restart restores it (acceptance test 6).
- 2026-09-12 — Hash routing with no router library; PWA base path is `/MPR-App/` for GitHub Pages.
- 2026-09-12 — Undo restores the field to the voided play's participants, which equals the field state at the time it was logged.
- 2026-09-12 — Removing a player who appears in any play deactivates instead of deleting, so the log stays intact.

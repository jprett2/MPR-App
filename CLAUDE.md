# CLAUDE.md — MPR Tracker

Sideline app for tracking the Pop Warner Mandatory Play Rule (MPR) for both teams in a youth football game. Full requirements are in `REQUIREMENTS.md`; read it before any work. This file covers how to work in this repo.

## Who this is for

Jacob Prettyman, parent volunteer MPR tracker for a 9U Chicagoland Pop Warner team (19 players, 12-play threshold). Coaches view live status on their phones. Jacob is technical and has shipped PWAs before; talk to him as a peer, keep summaries short, and lead with decisions that need his input.

## Priorities, in order

1. **Speed and forgiveness on the sideline.** Every play must be loggable in one tap after players are set. Undo and reclassify must be trivial. Never lose a play.
2. **Correctness of the counting rules.** The threshold table and non-counting play types are the whole point. Keep them in one config module with tests.
3. **Offline-first.** The app must fully work with no signal. Backend sync is additive.
4. Everything else.

## Stack (defaults — change with a one-line note in a decision log if there's a good reason)

- Vite + React + TypeScript, single-page PWA.
- State: a single game store (Zustand or equivalent) with an append-only play log; derived counts computed from the log, never stored as mutable tallies.
- Persistence: IndexedDB via a thin wrapper (idb / Dexie). Local is the source of truth.
- Sync: Supabase JS client; background push of local changes; realtime subscription for the coach view. Phase 2 — do not start until Phase 1 is shippable.
- Deploy: GitHub Pages via GitHub Actions on push to `main`. Manifest + service worker (vite-plugin-pwa) for iOS home-screen install and offline shell.
- Styling: plain CSS or Tailwind; big touch targets, high contrast, no hover states.

## Rules config

`src/config/rules.ts` owns:
- Threshold tables keyed by `{ league, division }` (Pop Warner national; Chicagoland 6U–9U with +2).
- Play types with `counts: boolean` and per-division visibility (kickoffs hidden at 9U Chicagoland).
- Status color thresholds (yellow ≤ 3 remaining; red when short in period ≥ 4).

Unit-test this module thoroughly, including out-of-range dressed counts.

## Conventions

- Plays are never hard-deleted; undo sets `voided = true`. Counts are always derived from non-voided, counting plays.
- Reclassifying a play changes `play_type` and recomputes `counts`; never mutate participant rows to "fix" a count.
- Keep the live tracking screen free of anything that isn't needed between snaps. Everything else goes on other screens.
- Design for iPad landscape first, iPhone portrait second. Check both before calling a screen done.
- Prefer working software every session: each session should end with something Jacob could open on his phone.

## Session workflow

- Start by reading `REQUIREMENTS.md` and `DECISIONS.md` (create the latter on first session; one line per decision with date and reason).
- Before writing code for a new screen, state the plan in a few lines and confirm any open assumption from REQUIREMENTS §9.
- End each session with: what shipped, how to test it on a phone, what's next.

## Do not

- Do not add practice-eligibility, positions, scoring, or down/distance. Out of scope.
- Do not require the backend for any sideline function.
- Do not store derived counts as source data.

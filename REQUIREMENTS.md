# MPR Tracker — Requirements Brief

**Owner:** Jacob Prettyman
**Status:** v1 brief, 2026-09-12. Expect minor additions after talking with the team.
**Goal for v1:** usable on the sideline at a 9U Chicagoland Pop Warner game, tracking both teams, within one week.

---

## 1. Purpose

Jacob is the parent volunteer responsible for tracking the Pop Warner Mandatory Play Rule (MPR) at his son's 9U games. He must track **both teams** fully: every scrimmage play, which players were on the field for each side, and whether every player reaches their minimum. Coaches need to see live status on their own phones. Today there is no standard sheet — each team preps its own.

The app replaces the paper sheet with a fast tap-based tracker, gives coaches a live read-only view, produces the third-quarter "who's still short" report for the ref huddle, and exports a per-player summary plus a full play log after the game.

## 2. Users and context

| User | Device | Role |
|---|---|---|
| Jacob (tracker) | iPhone or iPad (iOS Safari, home-screen PWA) | Sole data entry. Source of truth. |
| Coaches (viewers) | Their own iPhones | Read-only live status via shared link. No login required. |

Environment: outdoor field, possibly poor cell signal, bright sun, one hand free, 45-second play clock. Every interaction must be fast and forgiving.

## 3. Rules the app must encode

### 3.1 MPR thresholds

Threshold is derived per team per game from that team's **dressed (eligible) player count at game time**.

Pop Warner national minimum (10U–13U and older):

| Dressed players | Min plays |
|---|---|
| 16–25 | 10 |
| 26–30 | 8 |
| 31–35 | 6 |

Chicagoland Pop Warner, divisions **6U–9U**, require two extra plays:

| Dressed players | Min plays |
|---|---|
| 16–25 | 12 |
| 26–30 | 10 |
| 31–35 | 8 |

Store this as a config table keyed by `league` and `division` so moving to 10U is a one-line change. Jacob's team has 19 players and will almost always land in the 12-play bracket; opponents vary.

Edge case: dressed count below 16 or above 35 is outside the table. Use the nearest bracket (12 / 8) and show a visible warning that the count is out of range.

### 3.2 Which plays count

Only **live plays from the line of scrimmage** count toward MPR. The app logs every snap but flags non-counting ones. Play types:

| Type | Counts? | Notes |
|---|---|---|
| Scrimmage | Yes | Default. |
| Extra point (PAT) | No | Easy to miss — everyone is still lined up. |
| Penalty, down replayed | No | If the penalty is enforced and the down advances/is lost, the play DID happen and counts as Scrimmage. Tracker must be able to reclassify the last play after the flag is resolved. |
| Kickoff / free kick / return | No | Not used at 9U Chicagoland (possessions start at the 35 after scores and to start halves). Keep in config, hidden for 9U. |
| QB intentional spike | No | Rare at 9U. |

Play types and their counting flag live in config alongside the threshold table.

### 3.3 Game structure

- Four quarters. 9U Chicagoland: 10-minute modified clock. Quarter is tracked so the Q3 report and per-quarter counts work.
- **Third-quarter checkpoint:** at end of Q3 both teams meet with the referees and share counts. Any player short of the minimum must enter and stay in until met. The app must have a dedicated Q3 view for this.
- Overtime: one OT period possible in regular season. Treat as a fifth period; OT scrimmage plays count.

### 3.4 Eligibility

No practice-attendance eligibility tracking. Per game, a player is simply **dressed** or **not dressed**. Only dressed players count toward the threshold bracket and appear on the field grid.

## 4. Data model

```
Season
  id, name (e.g. "2026 9U"), league, division

Team
  id, season_id, name, is_home_team (Jacob's team = true), color

Player
  id, team_id, jersey_number (int), name (optional; opponents usually number-only), active

Game
  id, season_id, date, home_team_id, opponent_team_id, opponent_name,
  location, share_code, status (setup | live | final), current_period

GameRoster            -- one row per player per game
  game_id, player_id, dressed (bool)

Play
  id, game_id, sequence (int), period, play_type, counts (bool derived),
  offense_team_id (informational), created_at, voided (bool)

PlayParticipant
  play_id, player_id, team_id
```

Derived per player per game: `counting_plays = count(PlayParticipant where play.counts and not play.voided)`; `remaining = max(0, threshold - counting_plays)`.

Opponent teams are created per game from the opponent's game-day book (jersey numbers only). If the same opponent is played twice, allow reusing a prior opponent roster as the starting point.

## 5. Screens

### 5.1 Season & roster setup (once)

- Create season with league/division (drives the threshold config).
- Home roster: jersey number + name. Persists all season. Add/edit/deactivate.

### 5.2 Game setup (pre-game, ~2 minutes)

- New game: date, opponent name, location.
- Home team: toggle who is dressed today (default: everyone active). Shows dressed count and resulting threshold.
- Opponent: fast jersey-number entry. Numeric keypad, enter number, tap add, repeat. Show dressed count and their threshold. Option to import a prior opponent roster.
- Generate share code / link for coaches.
- Start game → status `live`.

### 5.3 Live tracking (the core screen)

**Layout (iPad landscape primary):** two roster grids side by side, home team on one side, opponent on the other. Each grid shows every dressed player as a large tile with jersey number and remaining-plays count. Tiles are toggled on/off to indicate "on the field for the next play."

**iPhone portrait fallback:** one grid at a time with a prominent team toggle, or both grids stacked with scroll. Either is acceptable in v1; side-by-side on iPad is the priority.

**Sticky field state:** the set of selected players persists from play to play. The tracker only taps players who changed. Never require re-selecting all 11. Show a live count of selected players per side (e.g. "11 on field", turns red if ≠ 11 — a warning, not a block; Pop Warner plays can legitimately have fewer).

**Controls:**
- Big **PLAY** button: logs one play with the current field state on both sides, play type = current selection, then resets play type to Scrimmage.
- Play type selector: Scrimmage (default) | PAT | Penalty-replay | other configured types. One tap.
- Possession indicator (which team has the ball) — informational O/D tag, not required. Swap with one tap.
- Quarter selector / "next quarter" button.
- **Undo last play.** Marks it voided (never hard-deletes) and restores the previous field state.
- **Edit last play type** (reclassify after a flag is resolved).
- Play counter: total plays and total counting plays this game.

**Status coloring per tile** (per player, based on `remaining` and current period):
- Green: remaining = 0 (met).
- Default: remaining > 3.
- Yellow: remaining 1–3.
- Red: remaining > 0 and period ≥ 4 (entering/into Q4 still short).
Thresholds for yellow/red live in config.

**Clear all / reset field** control for a full unit swap, with confirm.

### 5.4 Status & Q3 huddle view

- Per team: list of players still short, sorted by remaining descending, with jersey, name (if known), played, remaining.
- Big readable text for reading aloud in the ref huddle.
- Totals: dressed, threshold, players met, players short.
- Accessible any time; auto-suggested at end of Q3.

### 5.5 Coach live view (read-only, shareable link)

- Opened via share link / code, no login.
- Shows the home team's (Jacob's team's) status list, play count, current quarter, last-updated time. Optionally toggle to opponent.
- Updates within a few seconds of the tracker logging a play.
- No controls that mutate data.

### 5.6 Play log

- Chronological list of every play: sequence, quarter, type, counts?, possession, players on field per side, voided flag.
- Tap a play to edit type or participants (corrections after the fact).

### 5.7 Post-game / export

- Mark game final.
- **Summary export:** per team, per player: jersey, name, counting plays, met (Y/N). Screenshot-friendly layout and share-sheet text.
- **Play log export:** CSV of the play log with participants.
- Season view: list of past games; per-player counting plays per game for the home team (nice-to-have in v1, required by v2).

## 6. Sync, offline, and hosting

- **Backend:** Supabase (Postgres + realtime). Tables mirror the data model. Row-level security: tracker writes via authenticated session (Jacob only); coach view reads via share code through a policy or an RPC that exposes only that game's derived status.
- **Offline-first:** all writes go to local storage first (IndexedDB), then sync to Supabase in the background. If the field has no signal, the tracker keeps working and syncs when it can. Show a small sync-status indicator (synced / N pending / offline).
- **Conflict model:** single writer (Jacob's device), so last-write-wins is sufficient. Coach views are read-only.
- **Hosting:** static PWA on GitHub Pages. Service worker caches the app shell so it launches offline.
- **Auth:** simplest thing that keeps strangers from writing: Supabase magic-link or a single long-lived device token. Coaches never authenticate.

## 7. Platform

- iOS Safari, installed to home screen (manifest + service worker). Test on iPad landscape and iPhone portrait.
- Large touch targets (≥ 60pt tiles), high contrast for sunlight, no hover-dependent UI.
- Prevent accidental zoom/scroll on the grid. Prevent screen from sleeping while a game is live if the platform allows it.

## 8. Non-goals (v1)

- Practice attendance / eligibility tracking.
- Multiple simultaneous trackers on one game.
- Play-by-play details (down, distance, result, score).
- Player positions or depth charts.
- Matching any league's official form (none exists).
- Android support (should work anyway, but not tested).

## 9. Defaults and assumptions (change if Jacob says otherwise)

- Home team: 19 players, 9U, Chicagoland Pop Warner → 12-play threshold.
- Opponent rosters are jersey-number only.
- Yellow at ≤ 3 remaining; red when still short in Q4 or later.
- Field-count warning at ≠ 11 selected, non-blocking.
- Supabase over Firebase.
- Season history is a v2 priority, not a v1 blocker.

## 10. Build phases

**Phase 1 — sideline-ready (target: next game):** roster setup, game setup with dressed toggles and opponent entry, live tracking with sticky field state and play types, undo/reclassify, status colors, Q3 view, local persistence, summary + CSV export. Works fully offline with no backend.

**Phase 2 — live coach view:** Supabase sync, share link, coach read-only page, sync indicator.

**Phase 3 — season:** past games, per-player season totals, reuse opponent rosters, polish.

Phase 1 must be shippable on its own. Do not block sideline functionality on the backend.

## 11. Acceptance test (Phase 1)

Simulate a game: 19 home players, 22 opponents. Log 50 plays including 3 PATs and 2 penalty-replays, with unit swaps every ~6 plays. Verify:
1. PAT and penalty-replay plays appear in the log but no player's counting total increases.
2. Undo removes the last play from every affected player's count and restores the prior field state.
3. Reclassifying a play from Scrimmage to Penalty-replay decrements counts correctly.
4. Q3 view lists exactly the players with remaining > 0, sorted correctly, for both teams.
5. Thresholds: home = 12, opponent (22 dressed) = 12; change opponent to 27 dressed → 10.
6. Close and reopen the PWA mid-game with airplane mode on; all state is intact.
7. Summary export matches the log.

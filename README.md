# MPR Tracker

Sideline PWA for tracking the Pop Warner Mandatory Play Rule for both teams. See `REQUIREMENTS.md` for the brief and `CLAUDE.md` for working conventions.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173/MPR-App/`. Tests: `npm test`. Production build: `npm run build`.

## Test on a phone (same Wi-Fi)

```bash
npm run dev -- --host
```

Open the printed network URL (e.g. `http://192.168.x.x:5173/MPR-App/`) in iOS Safari, then Share → Add to Home Screen. Once deployed, use `https://jprett2.github.io/MPR-App/` instead; that build installs offline.

## Flow

1. **Roster**: create the season (league + division drive the threshold) and enter the home roster.
2. **Games**: create a game, toggle who's dressed, enter opponent jersey numbers, start.
3. **Live**: tap tiles to mark who's on the field (sticky between plays), pick a play type if not scrimmage, hit PLAY. Undo voids the last play and restores the field. "Last:" reclassifies the last play.
4. **Status**: the Q3 huddle list, per team, sorted by plays still needed.
5. **Log**: every play; tap one to change type, participants, or void/restore it.
6. **Export**: share summary text, summary CSV, or the play-log CSV; mark the game final.

All data lives in IndexedDB on the device. No backend is required for any sideline function.

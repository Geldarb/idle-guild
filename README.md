# Lantern Hall: Idle Guild Master

An original idle fantasy guild-management game for the browser. Plain HTML/CSS/JS, no build step.

## Play loop (v1)
- **Guild Hall**: build and upgrade rooms. Common Room (roster size) and Workshop (operations).
- **Workshop operations**: Lantern Forging (gold) and Provision Packing (supplies). Upgrade for clear per-second numbers; output doubles at milestone levels.
- **Adventurers**: unique recruits with class, rarity, level and Might/Agility/Wit. Higher renown = better recruits.
- **Quests**: five timed tiers (Errand → Saga) for gold, XP and renown, unlocked by renown rank.
- **Overseers**: assign an idle adventurer to an operation for a bonus (they also slowly gain XP).
- **Offline progress** with a "While you were away" summary. Autosave + export/import (code or file).
- Installable PWA with offline cache and a tap-to-update prompt.

## Code map
- `js/data.js`: all tunable content (facilities, operations, quest tiers, classes, names).
- `js/game.js`: rules and state, no DOM. `advance(state, now)` runs both live ticks and offline catch-up.
- `js/ui.js`: screens as functions returning HTML; `updateLive()` refreshes numbers without rebuilding.
- `js/main.js`: actions, loop, saving, service worker.
- `server.js`: tiny static server for Render (`npm start`).

## Extension hooks
- New facility: add to `FACILITIES` (drop `comingSoon`), add its screen in `SCREENS`.
- New system (exploration, hirelings): push `{ id, advance(state, seconds, report) }` onto `EXTENSIONS`, keep its state in `state.ext[id]`.
- Save shape changes: bump `state.v` and add a step in `migrate()`.

## Release
Bump `GAME_VERSION` in `js/data.js`, the `?v=` query strings in `index.html`, and `VERSION`/`ASSETS` in `sw.js`.

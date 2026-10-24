# Banner Road: Idle Heroes

An idle auto-battler RPG for phones and desktop browsers. Recruit up to five heroes, gear them with loot and watch them fight wave after wave down the Banner Road.

- **Battle lane:** heroes auto-fight 10 waves per stage, with a sub-boss on wave 5 and a stage boss on wave 10. Beating a boss sets your checkpoint; if the party falls it regroups at wave 1 of that stage and tries again.
- **Worlds:** Bramblewood and the Ashen Barrows (4 stages each), then the Endless Road.
- **Heroes:** 12 originals across Melee, Ranged and Mage. Each has an ultimate that fires on its own (or tap the hero card). Duplicates add stars.
- **Gold & training:** every kill pays gold; spend it to train heroes.
- **Loot:** 5 rarities, 5 slots (weapon, armour, shield, ring, accessory) with stat comparison. Salvage for gold. Drops never interrupt play.
- **Offline:** your party keeps farming for up to 24h at reduced efficiency (gold, XP and loot) and you get a summary on return.
- Installable PWA with offline play, an update prompt, save export and import, and fullscreen.

## Lantern Hall Classic

The original game (Lantern Hall v1.0.1, a guild-hall idle game) still lives at [`/classic/`](https://idle-guild.onrender.com/classic/). It has its own service worker scope (`/classic/`), its own caches (`classic-lantern-hall-*`) and its own save key (`lanternhall-save`), so old saves keep working there. Banner Road never touches them.

## Run locally

```sh
node server.js   # http://localhost:3000, no dependencies
```

Files: `js/data.js` (content and tuning), `js/game.js` (rules), `js/battle.js` (battle simulation), `js/draw.js` (canvas renderer), `js/ui.js` (screens), `js/main.js` (loop and actions), `classic/` (v1, unchanged apart from its service worker cache scoping).

When you release, bump the version in `js/data.js`, `sw.js`, the `?v=` query strings in `index.html`, and `package.json`.

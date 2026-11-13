# Max's Maple Quest

A MapleStory-style pixel platformer prototype built with **Phaser 3** and **Vite**. One short level ("Henesys Meadow"): run, jump, swing a sword, collect coins, hit checkpoints, and fight King Slime.

Live (public production): [maple-platformer.vercel.app](https://maple-platformer.vercel.app)

This is the game first. Habit-tracker hookup comes later: all hero power already flows through `getPlayerStats()` in `src/config/stats.js`.

## Run locally

```bash
npm install
npx playwright install chromium   # once, needed for the automated tests
npm run dev                       # http://localhost:5173
```

Other scripts:

```bash
npm run build                     # static build -> dist/
npm run preview                   # serve dist on http://localhost:4173
npm run assets                    # regenerate sprites, tiles, and SFX from tools/*.py
```

## Tests

The Playwright tests expect `npm run preview` (port 4173) to be running in another terminal.

```bash
npm run autoplay                  # bot plays the whole level + boss, checks checkpoint respawn, writes shots/
npm run test:boss                 # skip to the pre-boss checkpoint and fight King Slime
npm run test:mobile               # iPhone landscape+portrait: virtual joystick, multitouch, rotate prompt
```

Override the game URL with `URL=https://example.com npm run autoplay`. Run these before you push.

## Controls

**Keyboard:** Arrows or WASD to move · Space / Up / W to jump (hold for a higher jump) · X / J to swing the sword · M to mute · R to restart

**Phone (landscape):** left-thumb virtual joystick (drag to move; tilt-up does not jump), right-thumb JUMP (hold for height) and ATK. Mute is the HUD button or M. Tap the title to start. A "turn sideways" prompt appears in portrait.

**URL flags:** `?play` skips the title, `?debug` exposes `window.__debug`, `?stats={"attack":30,"maxHp":8}` overrides hero stats, `?touch` / `?notouch` force the on-screen buttons on or off.

## What's in the prototype

- **Checkpoints** mid-level and just before the boss. Touch a flag to raise it. At 0 hearts you get a K.O. and respawn at the last flag with full hearts (coins and kills are kept).
- **King Slime** at the end of the level. The portal stays locked until he's beaten. Each attack telegraphs with a flashing "!": yellow hop slam (jump the shockwaves), red charge (jump over him; a wall slam leaves him dizzy and vulnerable), purple summon of mini slimes. At 50% HP he enrages. Dying mid-fight resets the fight. Tuning lives in `BOSS` and `CHECKPOINT` in `src/config/tuning.js`.
- **Touch controls** on touch devices: a left virtual joystick (floating, analog, dead zone) plus JUMP / ATK buttons, landscape FIT scaling, and a rotate-your-phone prompt. Keyboard still works on desktop.

## Project layout

| Path | What it is |
| --- | --- |
| `src/config/stats.js` | Hero stats (`maxHp`, `attack`, `critChance`, `speed`, `jump`, `luck`) via `getPlayerStats()` — hook habits up here later |
| `src/config/tuning.js` | Physics, combat, juice, enemy, boss, and checkpoint knobs |
| `src/levels/level1.js` | ASCII level segments (easy to remix) |
| `src/objects/` | `Player`, `Slime`, `KingSlime`, `Checkpoint`, `Controls`, `TouchState` |
| `src/scenes/` | Boot, Title, Game, HUD (incl. boss bar), Touch, LevelComplete |
| `src/fx/Juice.js` | Hit-stop, shake, damage numbers, puffs, sparkles |
| `tools/` | Asset pipeline: `make_hero.py` + `pack_hero.mjs` (Phaser atlas via free-tex-packer-cli), world/SFX generators, `compress_pngs.sh` |
| `public/assets/` | Generated (and font) assets the game loads |
| `tests/` | Playwright autoplay, boss, mobile, and smoke scripts |
| `CLAUDE.md` | Notes for Claude Code: architecture, conventions, what to run before pushing |

## Collaborate (Grok Bot + Claude Code)

The source of truth is this private GitHub repo. Before starting work, pull. When you (or Claude Code) finish something, commit in small focused chunks, push, and mention it in chat so the other side can pull first.

```bash
git pull --rebase origin main
# ... work ...
npm run preview   # then, in another terminal:
npm run autoplay && npm run test:mobile && npm run test:boss
git add -p && git commit && git push
```

Do not commit `dist/`, `node_modules/`, zips, `deploy-payload/`, or the large `shots/*.mp4` files. Keep hero power flowing through `getPlayerStats()` so the habit tracker can plug in later.

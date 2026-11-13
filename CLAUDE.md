# Claude Code notes — Max's Maple Quest

Phaser 3 + Vite browser platformer. One level, "Henesys Meadow." You and Grok Bot share this private repo. Pull before you start; push when you finish; mention the push in chat so the other side does not overwrite you.

## Setup

```bash
npm install
npx playwright install chromium   # once, for tests
npm run dev                       # http://localhost:5173
```

## Commands to run before pushing

Tests talk to the production-like preview on port 4173, not the Vite dev server. In one terminal:

```bash
npm run build && npm run preview
```

In another:

```bash
npm run autoplay                  # full level + boss + checkpoint respawn; writes shots/*.png
npm run test:boss                 # START=boss, starts at the pre-boss checkpoint
npm run test:mobile               # iPhone 13 landscape+portrait: joystick, multitouch, rotate prompt
```

Optional: `URL=https://... npm run autoplay` against a preview deploy. `TIMEOUT` (ms) and `STATS` (JSON) are also honored by autoplay. Do not commit the large `shots/*.mp4` videos the tests may write; PNG screenshots in `shots/` are fine.

## Project layout

```
src/
  main.js                 Phaser.Game bootstrap (FIT scale, arcade physics, 4 pointers)
  config/
    stats.js              getPlayerStats() / BASE_STATS — ONLY place gameplay should read hero power
    tuning.js             PHYS, COMBAT, ENEMY, PROGRESSION, BOSS, CHECKPOINT, GAME_W/H, TILE
  levels/level1.js        ASCII segments concatenated L→R; buildLevel1()
  objects/
    Player.js             Movement, variable jump, sword swing; reads stats from the scene
    Slime.js              Hopping slime (and King Slime minis)
    KingSlime.js          Mini-boss: telegraph → slam / charge / summon; enrages at 50% HP
    Checkpoint.js         Flag; respawn point
    Controls.js           Keyboard + touch input facade (moveAxis for analog stick)
    TouchState.js         Shared touch/joystick state, TOUCH_UI layout, isTouchDevice()
  scenes/
    BootScene.js          Loads assets from public/assets/, then Title
    TitleScene.js         Tap / Space to start; launches Game + HUD + Touch
    GameScene.js          Level, collisions, combat, boss fight, portal, run state
    HUDScene.js           Hearts, coins, XP, boss bar
    TouchScene.js         Virtual joystick (left) + JUMP/ATK buttons (right); touch devices only
    LevelCompleteScene.js Results / stars / XP
  fx/Juice.js             Hit-stop, camera shake, damage numbers, puffs, sparkles
public/assets/            Sprites, tiles, backgrounds, fonts, sfx (ogg + mp3)
tools/                    Python asset generators
tests/                    Playwright: autoplay.mjs, mobile.mjs, smoke.mjs, hit.mjs
```

## Architecture

- **Scenes.** `BootScene` preloads everything under `assets/` (Vite serves `public/`). The hero is a Phaser JSON-hash atlas (`hero.png` + `hero.json`); other sheets are still frame-width spritesheets. `TitleScene` starts `Game`, `HUD`, and (on touch, or with `?touch`) `Touch`. `GameScene` owns the run: builds the tilemap from `buildLevel1()`, spawns the player / slimes / coins / flags / King Slime / portal, and drives combat + juice. On K.O. the player respawns at the last raised checkpoint with full hearts; coins and kills are kept. The goal portal stays locked until King Slime is dead. `window.__game` and `?debug` → `window.__debug` exist for tests.
- **Player.** `Player` uses arcade physics and `PHYS` (coyote time, jump buffer, variable jump cut). Attack reach, cooldown, invuln, and knockback come from `COMBAT`. Current power (HP, attack, crit, speed, jump, luck) must be read from `getPlayerStats()` — GameScene already does this. Do not hard-code a second copy of those numbers in Player or the HUD.
- **Enemies.** Regular slimes use `ENEMY.slime`. `KingSlime` uses `BOSS`: a telegraph ("!") then slam (shockwaves), charge (dizzy if it hits a wall, 1.5x damage), or summon. Enrage at half health speeds wind-ups and shockwaves and adds minis. Dying during `fight === 'active'` resets the fight. Mini slimes are `Slime` instances with `mini: true` and `BOSS.mini` stats.
- **Level format.** `src/levels/level1.js` is an array of 12-row ASCII segments. Legend: `#` ground, `=` one-way ledge, `o` coin, `s` slime, `P` start, `G` portal, `C` checkpoint, `K` King Slime, `A` arena gate, `h` potion, `e` elixir, `t` throwing-star pickup, `.` empty. Remix by editing segments; keep the start, two checkpoints, arena, and portal unless you mean to change the loop.
- **Items / inventory / ranged.** `getPlayerStats().maxJumps` (default 2) gives the hero a mid-air double jump (Player tracks `jumpsUsed`, resets on ground). `config/items.js` defines items + ranged tuning; `objects/Inventory.js` is the hero's bag. GameScene owns `this.inv`, spawns pickups (`spawnItem`/`collectItem`), heals via `useItem` (hotkeys 1/2 or tapping a HUD slot), and throws stars via `throwStar` (key F/C or the touch THROW button) — live projectiles live in `this.stars` and are stepped in `updateStars`. Ranged hits reuse `hitSlime`/`hitBoss` with a lower base damage (`RANGED.dmgMult`). Item/star icons are drawn procedurally in `BootScene.makeItemTextures()`, so no new art assets are needed.
- **Config.** Tweak feel in `src/config/tuning.js`. Tweak hero power only in `src/config/stats.js`. URL `?stats={"attack":30,"maxHp":8}` and `localStorage['mpq.stats']` already override `BASE_STATS` through `getPlayerStats()`.

## Habit-tracker hookup (later — do not bypass)

When habits are wired in, they should feed `getPlayerStats()` (or replace the override layer inside `stats.js`). Suggested mapping, not implemented yet: health → `maxHp`, work with Peter → `attack`, family → defense (add a stat if needed), friends → `speed` / `jump`, relationships → `luck`. Keep that function as the single chokepoint.

## Art pipeline

Sprites and SFX are generated, then checked into `public/assets/` so the game runs without the Python toolchain.

```bash
npm run assets
# which is:
#   python3 tools/make_hero.py      # tools/hero-frames/*.png  (64x56 named frames, 8-frame walk)
#   node tools/pack_hero.mjs        # packs frames via free-tex-packer-cli → public/assets/hero.png + hero.json (Phaser JSON hash)
#   python3 tools/make_world.py     # tiles, backgrounds, coin, portal, slime, slash, hearts, …
#   python3 tools/make_audio.py     # public/assets/sfx/*.ogg and *.mp3
#   python3 tools/make_extras.py    # kingslime, flag, shock, crown, boss/checkpoint SFX
#   bash tools/compress_pngs.sh     # pngquant --quality=80-95 then optipng -o2
```

`npm run assets:hero` rebuilds only the hero atlas (make_hero + pack).

Needs Python 3 with numpy and Pillow (`pip install numpy pillow`), plus `free-tex-packer-cli`, `pngquant`, and `optipng` on PATH. After regenerating, eyeball `public/assets/` and play a short run before committing. The hero is an atlas: change frame *names* (`hero-idle-0`, `hero-walk-0..7`, `hero-jump-0`, `hero-attack-0..2`, `hero-hurt-0`) and `COMBAT.attackActiveFrames`, not a frameWidth. Other sheets still use `frameWidth`/`frameHeight` in `BootScene.js`.

Walk frames are authored in `tools/make_hero.py` (Pillow: concept-pose bodies, boot stamps, cape sway, body bob, procedural sword — the sword must stay visible in every frame). LibreSprite 1.3 (`/opt/appimages/libresprite-v1.3-linux-x86_64.AppImage --batch`) works headless and is the right tool for later onion-skin polish of `tools/hero-frames/*.png`; the shipping atlas is always packed with free-tex-packer-cli, not LibreSprite. Do not trim or rotate hero frames (body box and feet depend on untrimmed 64x56).

## Conventions

- Small, focused commits. One idea per commit. Do not commit `dist/`, `node_modules/`, `*.zip`, `deploy-payload/`, `.vercel/`, or large `shots/*.mp4`.
- `git pull --rebase origin main` (or pull + merge) before you start, and again before you push if someone else may have pushed.
- Keep stats flowing through `getPlayerStats()`. Put new feel knobs in `tuning.js`, not scattered through objects.
- Keyboard and touch should both keep working. `Controls` + `TouchState` + `TouchScene` are the input path; `?touch` / `?notouch` are useful for testing. The left virtual stick is analog (dead-zoned `touch.axisX`) and must never jump — jump is the JUMP button (or Space/Up/W). Stick up is ignored. Multi-touch: hold the stick and tap JUMP/ATK with a second finger. The stick floats (first touch in the left 45% of the screen recenters the base under the thumb).
- Do not add secrets, tokens, or Vercel share links to the repo. The Vercel project is `maple-platformer` (`prj_VLihUhEWkCHOMpV9F7kNeGipFbzF`); do not change its production/target settings unless Max asked.
- Prefer editing the source and letting Vite rebuild over hand-editing `dist/`.

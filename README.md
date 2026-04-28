# Protect My Resume - Canvas Game Portfolio

Interactive resume-defense game built with vanilla JavaScript and HTML5 Canvas.

Players protect an in-world resume from attacking bugs using hammer attacks, charged skills, and movement controls that support both desktop and smartphone play.

## Project Goal

This repo combines:
- A playable game loop and combat system
- Resume content rendered directly in the world
- Data-driven balancing from JSON
- Mobile-first controls and accessibility improvements

The codebase is intentionally framework-free to keep runtime behavior explicit and easy to customize.

## Current Gameplay Summary

- Pre-game phase: explore/read the resume in the world (scroll and zoom)
- Start phase: accept quest button to begin combat
- Combat phase:
  - Move player
  - Tap/click attack for hammer slam
  - Hold attack at full power to trigger special skill
- Skill animation modes:
  - `shockwave`
  - `ropepull` (pull bugs in, jump/slam sequence, fire crack impact visuals)
- Progression:
  - Floors increase enemy challenge
  - Resume health can be damaged by enemies reaching the resume

## Controls

### Desktop
- Move/Aim: mouse position (player follows target)
- Attack: click / hold then release
- Admin panel: `Ctrl + Shift + Z`
- Reset: `R`
- Back: `B`

### Smartphone
- Left virtual joystick: analog movement (distance from center scales speed)
- Right hammer button:
  - tap for normal hammer
  - hold for charged skill when power is full
- Hidden admin unlock:
  - move to bottom-left map corner
  - slam hammer 5 times within 3 seconds

## Configuration

Main config file: `game_resume.json`

Key sections:
- `resumeLayout`: in-world resume dimensions
- `resumeTypography`: font sizing/layout for resume rendering
- `gameplaySettings`: baseline gameplay values
- `gameplaySettingsForSmartPhone`: mobile-only overrides

The game loads JSON at runtime and applies overrides to player, enemies, and skill defaults.

## Architecture Overview

### `js/game.js`
Main orchestrator.

Responsibilities:
- state initialization and game loop
- input routing (mouse/touch/mobile UI)
- spawning/updating enemies
- skill systems (shockwave, rope pull)
- camera and pre-game navigation
- drawing order for world + effects + HUD
- admin panel lifecycle
- loading and applying JSON config

### `js/player.js`
Player entity and procedural sprite renderer.

Responsibilities:
- target-chase movement
- directional facing
- hammer and gun animation timers
- full player sprite draw logic (horse, armor, hammer)

### `js/enemy.js`
Enemy entity for regular and boss variants.

Responsibilities:
- flee/eat behavior rules
- damage/stun/health handling
- boss and regular procedural rendering
- contact and spacing behavior support

### `js/particle.js`
Reusable particle effects for impact/catch/damage feedback.

### `game.html`
Game runtime page containing:
- canvas
- aim ring
- smartphone controls overlay
- script boot order for game dependencies

### `index.html`
Portfolio landing page linking into `game.html`.

## Frame Lifecycle

Per animation frame (`requestAnimationFrame`):
1. `update()`
   - resolve input state
   - update player/enemies/projectiles/skills/effects
   - apply game rules (damage, floor progression, transitions)
2. `draw()`
   - render terrain/resume
   - render entities and effects
   - render UI overlays

This deterministic order is useful when adding new mechanics.

## Notable Systems

### Rope Pull Skill
- Pulls enemies into ring around player
- Player jump + timed hammer swing
- Landing impact triggers:
  - fire-style cracks
  - shockwave ring
  - burst particles
- Fire crack lifetime is synchronized with rope-pull shockwave life

### Mobile Input Model
- Uses dedicated overlay controls in-game
- Canvas touch handlers are gated to avoid conflicting mobile actions
- Joystick movement is analog and capped by configured `playerSpeed`

### Admin Panel
- Runtime toggles for balancing/debugging
- Spawn controls and floor jump
- Skill animation selection
- Explicit close button

## Extending the Project

Recommended workflow:
1. Add config knobs in `game_resume.json`
2. Apply knobs in `applyGameplaySettingsOverrides()`
3. Keep update and draw concerns separated
4. Validate mobile and desktop paths after changes

Common safe extension points:
- New skill animations: `fireSkill()` dispatch and dedicated update/draw helpers
- New enemy variants: extend `Enemy` options and render branches
- New VFX: add emitters in `ParticleSystem` and call from combat events
- Additional mobile controls: extend `mobileControls` state and handlers

## Running Locally

Use a local server (recommended) because JSON config is fetched at runtime.

Examples:

```bash
python -m http.server 8000
```

or

```bash
npx http-server
```

Then open `http://localhost:8000` and navigate to `game.html` or `index.html`.

## Notes for Future AI Sessions

If you open this repo in a new AI session, start by reading:
1. `README.md`
2. `game_resume.json`
3. `js/game.js` top comment and constructor state fields
4. `js/player.js`, `js/enemy.js`, `js/particle.js` top comments

Those files now contain architecture-oriented comments so a new session can map behavior quickly.

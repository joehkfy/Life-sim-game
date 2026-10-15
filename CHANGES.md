# Phase 7 + hardening + upgrades (merged build)

- Phase 7 living city (NPC residents, traffic, weather, rigged avatars, home furniture, hygiene, starter homes) merged onto the hardened server.
- Every Phase 7 server service now uses transactions, row locks, atomic claims, integer-dollar money and zod validation.
- Adult-only actions (jobs, rent/buy, businesses, construction): age grows 1 year per real week.
- Everyone starts with a fixed $500 and a starter home (no currency-rate exploit).
- Competitions run in timed 5-minute rounds that auto-resolve; manual resolve is admin-only.
- Server-authoritative movement with teleport sync to the client; per-city socket rooms.
- Travel network generated for ~1,800 cities with a small route set (buses, trains, planes, country hubs).
- Replit-ready: single port, serves client build, `.replit` Reserved VM config, `.env.example`, smoke test.
- Not verified against a real Postgres database; run `npm run smoke` after setup.

# What changed in this version

## Critical fixes
- **Syntax error in `gameRoutes.ts`** (`/construction/roles` had an extra `)`) — the server could not compile.
- **Infinite money:** `POST /shops/buy` accepted a negative quantity, which *added* money and removed items. Quantities are now validated (1–99 integers).
- **Double-spend / duplication:** bank transfers, withdrawals, market purchases, property/plot purchases, job shifts, construction work and item use all read a value and then wrote back an absolute number. Two simultaneous requests could duplicate money or items. They now run in one transaction with row locks (`SELECT … FOR UPDATE`) and atomic claims (`updateMany … WHERE status = 'active'`).
- **Market:** `NaN` price passed the `< 1` check; items could vanish if the server crashed between "remove item" and "create listing"; buyers could be charged and then fail to receive items. All fixed and transactional. Max 20 active listings per player.
- **Construction created money from nothing:** owners paid 40% up front while workers' wages (the other 60%) were minted. An owner plus an alt account could profit on every build. The owner now pays 100% into escrow and workers are paid from it. Added `POST /construction/cancel` (full refund while no worker has joined).
- **Inventory silently destroyed items** that exceeded a stack limit while still charging for them. It now refuses instead.
- **Owners lost their house for free** by pressing "Leave home". Owners now just step outside; tenants move out.
- **Travel bypass:** entering any building skipped the airport/station distance check; the legacy "travel to city" call skipped it too. Both closed.
- **JWT secret** silently fell back to a public default. The server now refuses to start in production without a real one; tokens are pinned to HS256.

## Server hardening
- zod validation on every route (auth, character appearance, all game bodies/params).
- Safe error handling: players only see `GameError` messages; everything else is logged and returned as a generic 500 (no more Prisma internals).
- Rate limiting (login/register per IP + per email; game actions per player), body size limit, security headers, `trust proxy`.
- Login no longer leaks whether an email exists via response timing; register enforces an 8-character minimum.
- Sockets: auth timeout, time-based speed limit (no more speed-hacking by flooding small moves), world bounds, animation whitelist, chat rate limit, nearby chat by distance and city, private chat requires friendship.
- Fixed a logout bug: when a player logged in from a second place, the old socket's disconnect deleted the *new* session.
- Graceful shutdown saves positions and the world clock.

## Correctness
- Money columns are now `Int` (whole dollars) instead of `Float` — no float drift.
- Live player position is flushed to the database every 5 s (it used to be saved only on disconnect, so "must be near the airport / construction site" checks used stale data). Travel now moves the player's live session and notifies the client (`teleport` event).
- Players in different cities are in separate socket rooms.
- Needs decay is one SQL `UPDATE` instead of two queries per online player, and no longer overwrites concurrent changes.
- Skill gains use the job's `category` instead of fragile name matching (most jobs previously gave none).
- Salary is recorded as `salary` in the bank history.
- Friend requests can be re-sent after a rejection/unfriend (used to crash on the unique constraint); accept/reject is atomic; private message history returns the *latest* 50, not the oldest.
- `FullCharacter` now declares `cityKey` / `countryCode`; added missing DB indexes.
- Removed dead code (`countriesService.ts` with a cheap build bypass, duplicate `travelToCity`, disabled instant-build).

## Client
- Handles server `teleport` events (travel, anti-cheat snap-back).
- Marketplace sends whole-dollar prices; register form requires 8+ characters; legacy travel button is labelled "bus".

## Not changed (design decisions for you)
- Job `schedule` hours and job `location` are stored but not enforced.
- Property "rent per month" is charged once; there is no recurring rent.
- Two seeds define "Doctor" with different pay (150 vs 200); whichever runs last wins.
- Single-process assumption: presence/rate limits are in memory. Running several server instances needs a shared store (e.g. Redis) and the socket.io Redis adapter.
- The integration tests (`tests/concurrency.integration.test.ts`) were written but **not run** in my environment (no database / no network). The unit tests were run and pass.

---

## Merged feature build (post-security)

This tree also includes:
- Player businesses + hiring + salaries + customer purchases
- Vehicles, school/courses, competitions, leaderboards
- Detailed 3D city, phone OS apps
- Construction hire system, travel (plane/train/bus), market, notifications

Security utilities from the fixed branch (`util/money`, `util/db` row locks, `GameError`, hardened bank/market/inventory/construction/auth/sockets) are included.


## Phase 1 — Living World and Starter Homes

- New characters now receive a persistent, empty starter house in their selected city and spawn inside it. Creation assigns a home and character location together in one database transaction; a per-city advisory lock prevents simultaneous sign-ups from receiving the same starter-home slot.
- Added `cityKey` and `isStarterHome` to the `Property` model so residential properties can be queried and displayed in the correct city. Owned/rented homes are exposed through `GET /api/game/world/cities/:key/homes` and rendered as persistent exterior buildings with owner labels.
- Added an `Enter Home` prompt when the owner/tenant is standing near their home. Leaving a home returns the character to that property’s exterior entrance instead of dropping them in the city centre.
- New starter-house interiors use a permanent, unfurnished floor plan with walls, room dividers, windows, and an entrance. Furniture can be added later without having to rebuild the home's structure.
- Added a time-driven sky and lighting layer: the sun tracks the shared world clock; daytime lighting transitions through warm sunrise/sunset colours; the moon and stars appear at night; clouds drift across the city; birds fly through the daytime sky; and streetlights and home windows brighten after dark.
- Added a dedicated residential road district with pavements, lane markings, and streetlights. The first layout provides 24 residential streets (312 starter-home plots), with expanded ground/sky coverage and player movement bounds so the plots remain reachable. Distant houses keep a low-detail exterior to help mobile performance.
- Fixed character-creation validation so `countryCode`, `stateCode`, `cityKey`, `lifeStage`, and `age` survive schema validation instead of silently falling back to defaults.
- Fixed an existing extra closing parenthesis on `/construction/roles` which prevented TypeScript parsing of `gameRoutes.ts`.

### Database update required

After updating this source, run `npm run db:generate` and `npm run db:push` against the configured PostgreSQL database before starting the game. This is required because the `Property` model has two new fields. Back up a live database before applying schema changes.

### Verification note

TypeScript/TSX syntax parsing passed for the modified source files. A full application build could not be run in this environment because npm dependencies could not be downloaded and no `node_modules` directory was present. The app should be built and play-tested in the project’s normal environment after the database update.


## Phase 2 — More Physical City and Buildings

- Improved persistent home exteriors with single-storey starter-home proportions, sloped roof panels, framed windows, front threshold/porch, small path, planters, exterior wall light, and door hardware.
- Home doors now rotate open when entering and again before exiting. Door interactions preserve the existing authenticated server-side location transitions.
- Corrected exit-facing yaw so a character leaving a starter home faces away from the west-facing entrance rather than turning back toward the house.
- Starter-home interiors remain unfurnished, but gain cleaner wall segmentation around the door opening, floor joints, baseboards, window trim and sills, ceiling fixtures, and warmer interior lighting.
- Added client-side movement collision against generated city building footprints, named service-building approach zones, persistent homes, and starter-home interior boundaries/dividers. Axis sliding lets the character continue along walls rather than stopping dead on diagonal contact.
- Added central park walking paths, benches, and waste bins so the park reads as a usable public space.

### Verification

- TypeScript/TSX syntax transpilation passed for all client source files.
- A full TypeScript application build and browser gameplay test could not be completed here because dependency installation timed out and dependencies were not available in the working environment. Install dependencies in the project's normal environment and run `npm run build` before deployment.
- No new database schema changes are required for Phase 2.


## Phase 3 — Interactive Home and Everyday Life

- Added a furniture catalog for beds, sofas, televisions, refrigerators, stoves, showers, floor lamps, desks/computers, dining tables, and bookshelves.
- The Home phone app can buy and place furniture into the currently occupied home, reload the persistent furniture layout, move items to room presets, and sell items for a 50% resale refund. The server checks home permissions, requires the character to be inside the home for changes, validates placement bounds, finds open nearby spaces, and handles purchase / property updates transactionally.
- Persisted furniture is rendered as interactive 3D models in the matching home interior. Clicking an item opens an interaction panel; placing, moving, selling, or toggling a lamp refreshes the interior view.
- Added useful home activities with server-side cooldowns: sleeping restores energy, resting and TV improve happiness, the refrigerator and stove reduce hunger needs, showers restore hygiene, reading develops creativity, and computer use practises skills. Lamps can be switched on or off.
- Added a persistent `hygiene` character stat, HUD meter, and online needs decay.

### Database update required

The `Character` model now includes `hygiene`. Back up a live database, then run `npm run db:generate` and `npm run db:push` before launching the updated game. These commands use your configured `DATABASE_URL`.

### Manual smoke test

1. Start the updated app and log in to a character who owns a home.
2. Open the Home app while standing inside the home. Buy a sofa and a bed; check that the money total drops and the 3D furniture appears.
3. Click the bed and choose Sleep. Confirm the energy bar rises, then try again immediately and confirm the cooldown message appears.
4. Buy a lamp and toggle it; its light should turn on/off.
5. Move a furniture item to another room preset and then sell it. Confirm the furniture disappears and the 50% refund is applied.
6. Step outside and re-enter the house. Confirm the layout remains saved.
7. Try placing furniture from outside the house or interacting with another user's home; the server should reject unauthorized changes.

### Verification note

The source was checked and the ZIP archive was validated, but full typechecking / browser play-testing still needs to be run in an environment with dependencies installed and a configured PostgreSQL database.


## Phase 4 — Animation System

- Replaced the rigid avatar with a procedural joint-based stylized character: articulated arms, forearms, thighs, shins, detailed hands, layered hairstyle options, facial highlights, eye colours, blinking, and soft idle motion.
- Added walk/run cycles with alternating legs/arms, knee bends, torso motion, and smooth pose blending.
- Added timed action poses/animations for sleep and waking, sit/relax, TV watching, eating, cooking, showering, computer typing, and reading with a visible book.
- Character interactions now move the player toward nearby furniture, orient them to the object, and then play the action animation.
- Synced the currently playing animation to other players via the existing movement events, and expanded the server animation allowlist to include these action states.
- Added a chair to the desk furniture model for the computer-use interaction.
- See `PHASE4_ANIMATION_TESTING.md` for testing steps and known limitations.

## Phase 5 — Natural Poses and Furniture Alignment

- Changed the avatar's animation pivot to hip height so sleeping rotation happens around the hips; the lying pose now rests lower at mattress height and aligns the head near the bed pillows.
- Lengthened and smoothed the sleep/wake transition, including a gradual camera focus change.
- Added a distinct seated TV-watching pose and updated the client to use the nearest sofa, then turn toward the selected TV. If no sofa is placed, the character uses a standing watch pose.
- Improved standing-up transitions after seated interactions by blending hips, knees, arms, torso and head back toward idle rather than resetting them abruptly.
- Added irregular eye blinks and subtle eye, brow, and mouth expression adjustments to support idle, sleep, run, eating, cooking and relaxed poses.
- Corrected the interaction target offsets to match the 0.5-scale home interior, improving positioning at beds, sofas, desks, dining chairs, showers, stoves, refrigerators and bookshelves.
- Interaction approaches can ignore the collision box of the specific furniture item being targeted, while retaining collisions against other objects and walls.
- Published the home's loaded furniture list to the interaction controller and added `watch_tv_sit` to the server animation allowlist in source and included `dist` output so multiplayer clients can see the seated TV pose.
- No database schema changes are required. See `PHASE5_ANIMATION_TESTING.md` for the manual play-test checklist.

### Verification note

The modified TypeScript/TSX files passed TypeScript transpilation syntax checks. A full build and live browser test remain unverified because npm dependency installation timed out in this environment. Run `npm install` and `npm run build` in the normal development environment and follow `PHASE5_ANIMATION_TESTING.md` before deploying.

## Phase 6A — Rigged Donghua Character Foundation

- Added an original lightweight GLB humanoid with a glTF skin (`JOINTS_0`, `WEIGHTS_0`, inverse bind matrices), a 19-joint hierarchy, 17 skinned mesh groups, and 20 named animation clips.
- Added `RiggedAvatar.tsx`, which loads and clones the model per character, customizes skin/hair/eye/shirt/trouser colours, switches one of four hairstyle variants, and plays skeletal animation clips through Three.js `AnimationMixer` with cross-fades.
- Connected existing player animation states to idle, walk/run, sitting, TV, typing, eating, cooking, showering, reading, sleep, waking, and stand-up clips. Sitting and sleeping use explicit transition clips; the old procedural avatar remains as loading/error fallback.
- Added the reproducible model generator at `tools/generate_lifesim_donghua_avatar.py` and a pipeline/testing guide in `PHASE6A_CHARACTER_PIPELINE.md`.

### Limitations / verification

- This is the first skinned game asset and a meaningful rigging foundation, but its geometry and clips are custom procedural/stylized, not motion-captured or artist-finished. Exact finger contact, foot IK, facial blendshapes/lip-sync, and polished bed/seat alignment remain future work.
- GLB structure, joint/accessor references, clip targets, and mesh skin attributes passed programmatic validation. Full application compilation and browser gameplay still need verification with dependencies installed.
- No database schema update is required.


## Final consolidated character animation pass (October 2026)

This final animation archive consolidates the skeletal avatar, home-interaction actions, social gestures, facial expression morphs, and multiplayer animation-state handling.

- Expanded the original GLB character to a 41-joint rig with articulated fingers and secondary hair-tip joints.
- Expanded the library to 54 named clips spanning idle/breathing, walk/run starts and stops, jump/land, crouch enter/hold/exit, sitting, sleep/wake, home activities, object carrying, social gestures, dance, washing hands, and brushing teeth.
- Added a more complete Emotes panel that scrolls on mobile and makes the gesture/action set testable in-game.
- Added attached food, drink, phone, book, toothbrush, and carry-box props that follow the character rig.
- Added safe-clamped two-bone arm IK anchors for actions that benefit from hand/object alignment.
- Added facial morph animation for blinking, mouth motion, smile, and brow expression, plus subtle hair-tip follow-through.
- Added touch/keyboard jump animation synchronization with bounded server-side airborne positions.
- Improved recovery logic so standing actions do not unnecessarily play a sit-to-stand animation after every activity.

The animations are project-authored procedural keyframes, not motion-captured performances. Paired two-player gestures and exact contact mechanics remain approximate. See `PHASE6_FINAL_ANIMATION_SYSTEM.md` and `PHASE6_FINAL_ANIMATION_TESTING.md` for the architecture, known limitations, and test checklist.

## Phase 7 — The Living City (2026-10-09)

- Added scheduled stylized residents with role-dependent daily routines using the shared GLB character and animation rig.
- Added road-grid sidewalks, scripted resident conversations, city activity HUD, main-road traffic, taxi/bus models, traffic-light phases, bus-stop props, rain particles, storm flashes, and wet-road overlays.
- Added deterministic shared weather changes in six-game-hour blocks, persisted to the existing world-state weather field, and slowed ambient traffic during rain/storm conditions.
- Switched the local and remote player renderers to `RiggedAvatar` so the skeletal model is used for player characters as well as residents.
- Added `PHASE7_LIVING_CITY.md` documenting implementation scope and limits.
- Client-side ambience only: NPCs and traffic are not yet server-persistent or replicated between players. AI dialogue now goes through a secure server endpoint when Groq is configured; local fallback replies work without a key. No database migration is required.
- Static TypeScript/TSX transpilation passed. A full dependency-backed application build could not be completed in this environment because `npm install` timed out.


## Railway deployment readiness (October 14, 2026)

- Fixed Railway's build command so it builds `client/dist`; previously it only generated Prisma and the server would start without the browser app files.
- Added a first-start initializer that applies the Prisma schema and seeds the large static world only when the database is empty/partially seeded. Normal restarts skip that seed.
- Added a configurable `ADMIN_EMAILS` allowlist for safely granting the existing server-side admin role on registration or the next login; clients cannot set their own role.
- Added server-side Groq-backed resident conversations with free-text chat, short context history, an authenticated `/api/game/npc/chat` endpoint, per-player rate limiting, 12-second provider timeout, and local fallback replies when the key is absent or the provider fails. This avoids exposing the API key in the browser and prevents an NPC from staying in a perpetual typing state.
- Added a GitHub Actions workflow for TypeScript checks, unit tests, and the production client build.
- Added Railway deployment instructions for the existing Postgres + web-service layout.
- Validation performed here: all 87 TypeScript/TSX files passed syntax transpilation; package and Railway JSON files parsed. Full dependency-backed type-check/build and live PostgreSQL/gameplay smoke tests remain pending because npm dependency installation timed out in this environment.

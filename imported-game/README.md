# Life Sim — Persistent Multiplayer 3D Life Simulation

## Deploy the full game to Railway (API + 3D client + PostgreSQL)

This repository is configured for a single Railway web service that serves the 3D browser client and API together, plus the existing PostgreSQL service. The first app start applies the Prisma schema and initializes the static game world when the database is empty/partially seeded. Subsequent restarts skip the long world seed once enough countries, cities, and items exist.

1. Upload/push the project files to a GitHub repository and connect that repository to the Railway project.
2. In Railway, keep the existing **Postgres** service. Create a web service from the GitHub repository in the same project.
3. In the web service's Variables, set `DATABASE_URL` to the Postgres service reference (select the Postgres service's `DATABASE_URL` from Railway's reference-variable picker), set `JWT_SECRET` to a unique random string of at least 32 characters, and set `NODE_ENV=production`.
4. Deploy. `railway.json` builds the browser client and starts the API only after the schema and first-time static world initialization are complete.
5. In the web service's Settings/Networking, generate a public domain. Open `https://YOUR-DOMAIN/health`; it should return `{"status":"ok","db":"up",...}`. Open the root domain to play.
6. Optional: set `ADMIN_EMAILS` to a comma-separated list of trusted account emails. Those emails get admin permission on registration or next login. Do not use an email you do not control.

Keep the app service to **one replica** for now: connected-player presence and socket sessions are held in server memory. Do not expose database credentials or commit `.env` files. Initial world seeding can take a little while on a small database; let the first deployment finish before testing character creation.

## Quick start on Replit
1. Create a Repl from this zip. Add the **PostgreSQL** tool (it sets `DATABASE_URL`).
2. In **Secrets** add `JWT_SECRET` (any random 32+ character string).
3. In the Shell run once: `npm run setup` (installs, generates Prisma, creates tables, seeds the world and travel routes).
4. Press **Run** to try it. To publish, use **Deploy → Reserved VM** (not Autoscale: players and sockets live in server memory).
5. Optional check against the running server: `npm run smoke`.

One port serves both the API and the built client. Run `npm run build` before `npm run start` in production (the deploy config does this).


**Real players are the heart of the multiplayer world. Phase 7 also adds lightweight client-side ambient residents and traffic so the city feels active even when few players are online.** These ambient actors are not yet server-persistent or shared/replicated across clients.

## What works

### Core
- Register / Login / Logout / JWT sessions
- Character creation
- PostgreSQL persistence
- 3D city + **building interiors** (enter/exit shops, school, gym, hospital, homes…)
- Mouse-look + WASD + **mobile virtual joystick**
- Real multiplayer (see other players, nameplates, sync)
- Nearby chat + **private messages**
- Shared world clock + needs decay
- Dynamic day/night lighting, sunrise/sunset colours, moving clouds, visible sun and moon, night stars, and daytime bird flight
- Weather-aware sky tint and cloud colours (when the server weather changes)
- HUD (stats, cash, bank, time, online count)

### Economy
- Shops (General Store, Restaurant, Clothing)
- Inventory (use food, equip clothes)
- **Bank account** — deposit, withdraw, transfer to other players
- Jobs — apply, work shifts, earn pay, level up, quit

### Social
- Search players
- Friend requests (accept / reject)
- Friends list
- Private messaging (persisted)
- Transfer money to friends

### Housing
- Every newly created character receives a personal, empty starter house in their selected city
- New characters begin inside their own house
- Starter homes have persistent city positions and visible exterior buildings, even when their owners are offline
- A 24-street residential district provides persistent home plots, with pavement, lane markings, and streetlights
- Starter-house exteriors include a pitched roof, framed windows, a small porch/path, planted pots, a door light, and a hinged door
- The home entry prompt opens the exterior door before entering; the exit prompt opens the interior door before returning to the street
- Starter-house interiors remain unfurnished and now include room dividers, window trim, skirting, floor joints, ceiling lights, and improved lighting
- Client-side movement collision prevents walking through visible city buildings and most interior walls, with sliding movement along obstacles
- Home ownership and existing rent/buy flows remain available
- Buy and place persistent furniture from the Home app: bed, sofa, TV, fridge, stove, shower, lamp, desk/computer, dining table, and bookshelf
- Furniture appears as 3D objects inside the house, can be clicked to interact, moved to room presets, and sold for a 50% resale refund
- Working home activities restore energy, improve mood, reduce hunger needs, improve hygiene, or develop skills; activities have server-side cooldowns
- Added a persistent hygiene need that decays while a player is online and can be restored by using a shower

### Character animation (Final consolidated animation pass)
- GLB skeletal avatar with 54 named animation clips on a 41-joint lightweight rig
- Body, arm, leg, finger-chain, and secondary hair-tip joints
- Blended idle/walk/run starts and stops, jump/land, and crouch enter/hold/exit transitions
- Sit, relax, watch TV, sleep/lie-down/wake-up, eat, drink, cook, shower, type, read, use phone, open doors, wash hands, and brush teeth
- Object-handling clips for reaching, picking up, carrying, putting down, and holding a box
- Social/action library: wave, talk, laugh, clap, shrug, point, handshake, fist bump, celebrate, stretch, yawn, nod, shake head, look around, dance, and kneel
- Facial morphs for blinking, mouth opening, smile, and eyebrow expression; attached food/drink/phone/book/toothbrush/box props
- Lightweight, safely clamped two-bone arm IK for hand targets; subtle hair follow-through
- Emotes panel is available on desktop and mobile. Space or the mobile Jump button triggers a server-timed jump arc
- Existing procedural avatar retained as an asset-loading/error fallback
- The character and animation library are original procedural geometry/keyframes, not motion captured. Contact poses, foot locking, detailed body deformation, and paired two-player gestures still need artist/kinematics refinement
- See `PHASE6_FINAL_ANIMATION_SYSTEM.md` and `PHASE6_FINAL_ANIMATION_TESTING.md`

### Mobile
- Virtual joystick
- Run and Jump buttons
- Use/Interact button
- Scrollable character Emotes panel
- Touch camera look and touch-friendly menus

### AI resident conversations (Groq)

The resident dialogue panel supports free-text messages and short conversation history. Set `GROQ_API_KEY` as a **server-only** secret to enable Groq responses; `GROQ_MODEL` can override the default `openai/gpt-oss-20b`. Without a key, the game returns schedule-aware local replies instead of leaving the player waiting. NPC requests are authenticated and limited to 10 messages per player per minute. Never put the key in `VITE_SERVER_URL` or any client-side environment variable.

## Replit setup

```bash
npm install
# set DATABASE_URL, JWT_SECRET, CLIENT_URL in Secrets
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

## Controls

| Desktop | Mobile |
|---------|--------|
| WASD move | Virtual joystick |
| Shift run | RUN button |
| Click + mouse look | Touch drag (camera via movement) |
| Bottom bar menus | Same large buttons |
| Enter building when near | Enter prompt / USE |

## UI buttons (bottom)

🎒 Inventory · 💼 Jobs · 🏪 Shop · 👤 Character · 👥 Friends · 🏦 Bank · 🏠 Housing

## Playable loop

1. Register → create character → wake up in your own empty starter home
2. Walk through the front door into the shared city; your home's exterior stays on the map
3. See the sky change as the world clock moves through morning, afternoon, sunset, and night
4. Explore, visit shops, and buy food
5. Get a job → work → earn money
6. Deposit to bank / transfer to friends
7. Add friends → private message and invite them over
8. Log out → return later — your home and character remain saved  

## Current simulation scope

Phase 7 adds local ambient residents with daily schedules and scripted conversations, plus local traffic, traffic signals, a moving bus/taxi, and weather-reactive city effects. Real human players remain the core multiplayer experience.

The following are still future work: NPC state and vehicles authoritative/persistent on the server, realistic collision avoidance between all agents, fully navigable NPC interiors, a true customer-demand/economy simulation, and advanced freeform furniture placement with drag, snapping preview, and room-specific object collision. Groq-backed free-text resident chat is now available when `GROQ_API_KEY` is configured; local fallback dialogue remains enabled otherwise.


## Phase 4 — Character animation and Donghua-inspired avatar

Phase 4 adds a custom articulated avatar rig with improved proportions, layered hair, expressive eyes, subtle idle breathing and blinking, and procedural walking/running cycles. Household actions now trigger character poses and short animations for sleeping/waking, relaxing, watching TV, eating, cooking, showering, using a computer, reading, and sitting. Nearby players receive these animation states through the existing multiplayer movement stream. The desk furniture also has a chair to support the computer-use pose.

See `PHASE4_ANIMATION_TESTING.md` for the test checklist and current animation limitations. The animations are procedural rather than motion-captured, and precise hand-to-object contact / full inverse kinematics remain future improvements.

## Phase 5 — More natural character animation

Phase 5 improves procedural pose transitions, irregular blinking and subtle facial expressions, lowers the sleeping pose to bed height by rotating around the hip pivot, and smooths the wake-up/camera transition. Interaction offsets now account for the home's interior scale and can align more closely with targeted furniture. When a sofa and TV are available, the character sits on the nearest sofa and faces the screen; the server allowlist supports the new `watch_tv_sit` animation for multiplayer.

Animations remain procedural and stylized rather than motion-captured. Full inverse kinematics and exact hand-to-object contact are still future work. See `PHASE5_ANIMATION_TESTING.md`. No database update is required.

## Phase 7 — The Living City

Phase 7 adds schedule-driven ambient residents, resident conversations, street-grid routes, traffic signals, moving vehicles (including a taxi and bus), bus stops, rain/storm visuals, and a city activity indicator. It also routes local and remote player rendering through the GLB-based `RiggedAvatar` component.

See `PHASE7_LIVING_CITY.md` and `PHASE7_LIVING_CITY_TESTING.md` for scope and test steps. This release requires no database schema migration. NPC schedules and traffic are client-side visual simulation, not persistent server actors; resident identity and schedules are local visual data, dialogue requests are handled by the authenticated server endpoint, and vehicle positions are not multiplayer-replicated.

# Phase 7 — The Living City

This update adds a client-side city-life simulation on top of the existing Life Sim project.

## Included

- Scheduled residents using the same rigged GLB character and animation controller as players.
- Fourteen resident profiles on desktop and six on touch/mobile layouts, with varied appearance, roles, routes, and daily schedules.
- Resident routines for school, work, shopping, the park, dinner, night shifts, and going home. Residents hide at their destination to represent going inside rather than standing outside through a whole shift.
- Clickable residents with local dialogue actions: greet, ask for directions, and talk about the day. These are schedule- and weather-aware scripted replies, not connected AI/LLM conversations.
- A street grid, pavements, and broken centre markings connecting central city blocks.
- Ten lightweight ambient vehicles on the two main roads on desktop (four on touch/mobile), with headlights, brake lights, and traffic-signal stopping logic.
- Animated traffic signals with shared phase derived from the game's world clock.
- Rain streaks, storm flashes, and wet-road overlays for rainy/stormy weather.
- A small city activity HUD showing the current daily period, weather, resident count, and ambient vehicle count.
- The local player and remote players now use `RiggedAvatar`, so the new GLB skeleton and animation clips are actually used by player characters as well as residents.

## Important scope notes

- Resident routines, ambient traffic, rain particles, and resident conversations are currently client-side ambient simulation. They are not persistent server-owned NPC entities, and ambient cars are not replicated across multiplayer clients.
- The residents enter/hide at destination locations as a lightweight simulation; the current release does not create fully navigable NPC interiors, persistent NPC inventories, or a simulated customer/economy ledger.
- Resident identities and schedules remain client-side visual data. Free-text resident conversations use the authenticated server-side Groq integration (configure `GROQ_API_KEY`); requests are rate-limited, time out safely, and fall back to schedule-aware local replies when Groq is unavailable.
- The server now chooses shared weather deterministically in six-game-hour blocks and persists it through the existing `WorldState.weather` field. No schema migration is required. Rain and storms slow ambient vehicles and affect outdoor resident routines.

## Test checklist

1. Run `npm install` and then `npm run build` from the repository root.
2. Enter the city during daytime and check that residents walk along the new street grid.
3. Click a visible resident and test all three dialogue buttons.
4. Wait for a schedule change and confirm that workers/students hide at their destination and later return to the city.
5. Check the main crossroads: vehicles should stop at red signals and proceed when their axis turns green.
6. Test at night: vehicle lights should glow and most residents should be indoors.
7. Test rainy and stormy weather: rain and wet road overlays should appear; stormy weather should occasionally flash.
8. Test on a touch-sized viewport; the resident and vehicle counts should be lower.
9. Verify the local character and remote characters display the GLB model and receive walk/run/interaction animation states.

## Run

```bash
npm install
npm run build
npm run dev
```

No database schema update is required by Phase 7.

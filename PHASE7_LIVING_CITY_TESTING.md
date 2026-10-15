# Phase 7 — Living City Test Plan

## Build checks

1. At repository root, run `npm install`.
2. Run `npm run build` and resolve any environment-specific or application errors before deployment.
3. Run `npm run dev` and log in with an existing test character.

## Residents

- Confirm the new GLB character is used for the local player and remote players.
- Confirm six residents appear on touch/mobile layouts and fourteen on desktop layouts.
- Watch residents move along city streets with walk animations.
- Click a resident and use **Say hello**, **Ask directions**, and **Talk about the day**.
- Confirm the resident performs a gesture/talk animation and the conversation panel updates.
- Advance the world clock through morning, working hours, evening, and night. Residents should commute, disappear at destinations, and return to public areas according to role and schedule.

## Traffic

- Verify ambient cars move along the central roads.
- Verify a taxi and bus are present on desktop, and lighter traffic is shown on mobile.
- Verify traffic lights switch between vertical and horizontal phases.
- Vehicles approaching the intersection should stop for a red phase and continue when their axis receives green.
- Check headlight/brake-light appearance during night and stopping.

## Environment

- Verify the city street grid and pavement meshes connect around the core blocks.
- In rainy weather, check the falling rain and wet-road layer.
- In stormy weather, check occasional lightning flashes.
- Confirm the activity indicator reflects the time period and weather.

## Regression checks

- Enter and exit a player's house.
- Use bedroom, sofa, desk, kitchen, shower, and reading interactions.
- Verify weather/day-night rendering still works.
- Test desktop and mobile controls.
- Verify remote player animations update through the existing socket system.

## Known scope limits

Residents use scripted schedules and dialogue in this release. They do not yet have server-persistent identities/inventories, transactional ties to the economy, fully navigable interiors, or LLM-backed dialogue. Ambient traffic is local to each client rather than replicated as authoritative vehicles.

# Phase 3 Testing — Interactive Home

## Setup

Back up a live database, then run from the project root:

```bash
npm install
npm run db:generate
npm run db:push
npm run build
npm run dev
```

The `hygiene` column is new in Phase 3. Do not start the updated server against an old schema before applying the schema update.

## Gameplay checklist

- Log in to a character with a home and enter that home's interior.
- Open Phone → Home & Furniture. Select a room and buy a sofa or bed. Confirm the purchase uses cash and the matching 3D item appears.
- Click the 3D bed and choose Sleep. Energy should increase. Repeat immediately and confirm the server cooldown is enforced.
- Buy a shower, fridge, stove, desk, bookshelf, TV, dining table, and lamp; verify each renders and offers its matching activity.
- Toggle the lamp twice. The emissive bulb / point light should react.
- Move a furniture item to another room preset and sell it. The item should disappear, and the character should receive half its listed price.
- Step outside, re-enter, and confirm the home's furniture persists.
- Verify the Hygiene HUD bar decreases gradually while online and rises after showering.
- Check that modifying furniture while outside is rejected, and a character cannot modify a home they do not own or rent.

## Known scope limits

- Moving furniture currently uses room presets from the phone app rather than drag-and-drop placement in the 3D scene.
- The first home activities adjust character needs and skills but do not yet advance the shared world clock for sleep.
- The furniture system is built for starter-home interiors. More floor plans, chair/door clearance, and fine collision rules can be added in a later phase.

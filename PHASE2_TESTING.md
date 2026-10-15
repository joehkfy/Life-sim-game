# Phase 2 Smoke Test Checklist

Phase 2 does not add database fields. Existing Phase 1 installations do not need an additional schema update for these changes.

## Start the game

```bash
npm install
npm run build
npm run dev
```

If the database has not yet been upgraded to the Phase 1 schema, back it up first, then run:

```bash
npm run db:generate
npm run db:push
```

## Verify the house experience

1. Create a new character. The character should begin inside their own empty starter home.
2. Walk around the interior. The character should stay within the walls and should not pass through the room divider walls.
3. Choose **Open Door · Exit to City**. The interior door should swing open before the transition finishes.
4. Outside, verify that the character is at the entrance of their own house and faces away from it.
5. Walk back towards the house. The **Enter Home** prompt should appear when close enough.
6. Select **Enter Home**. The exterior door should swing open before the scene changes back into the interior.
7. Verify the starter home has no movable furniture. Architectural trim, the ceiling lights, glazing, and room dividers are part of the shell.
8. Walk into a visible city building or named service-building footprint. Movement should stop at the obstacle and allow sliding along its edge.
9. Check the environment at different world-clock times to confirm Phase 1's sky/day-night features still work.

## Known verification limitation

The source syntax check passes, but a full TypeScript build and live browser test could not run in this working environment because dependency installation timed out. Please run the build and smoke test in the normal project environment before publishing.

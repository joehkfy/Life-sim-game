# Paste this into Cursor (Agent mode)

You are working on Life Sim, a persistent multiplayer 3D life simulation. Read README.md, CHANGES.md and `.cursor/rules/life-sim.mdc` first, then do these in order. After each step run `npm run typecheck` and `npm test`, fix every error, and tell me what you changed.

1. SETUP CHECK: run `npm install`, then `npm run typecheck`. This code was never typechecked against the real libraries, so fix any type errors without changing behaviour.
2. DATABASE: run `npm run db:generate && npm run db:push && npm run db:seed`. Fix any schema or seed errors. Then start the app with `npm run dev` and run `npm run smoke` (BASE_URL=http://localhost:3001 if the dev server uses that port). Fix every failing check.
3. PLAY TEST: open the client, register, create a character, walk around, enter a building, buy something, deposit and withdraw at the bank, apply for a job. Fix anything broken or ugly.
4. TWO-PLAYER TEST: open two browser windows with two accounts in the same city. Check that they see each other move, chat works, and a bank transfer between them works.
5. PHASE 8: add a city snapshot API (`GET /api/game/city/:cityKey/snapshot`) and resident interactions (`POST /api/game/city/:cityKey/residents/:residentId/interactions`) so ambient residents feel alive. Keep residents cosmetic: they must never give or take money or items.
6. POLISH: loading screen, clear error messages, mobile controls check, and lower 3D draw calls (instancing, fewer lights) so it runs on phones.
7. REPLIT: confirm `npm run build` then `npm run start` serves the client and API on one port.

Rules: do not weaken any security or money rule in `.cursor/rules/life-sim.mdc`. Ask me before adding a new dependency or changing the database in a way that deletes data.

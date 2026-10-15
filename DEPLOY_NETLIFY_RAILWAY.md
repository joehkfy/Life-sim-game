# Deploy: Netlify (client) + Railway (server + database)

## 1. Railway (server)
1. Push this project to a GitHub repo.
2. railway.com > New Project > Deploy from GitHub repo > pick it.
3. In the project click **+ New > Database > PostgreSQL**.
4. Open the server service > Variables, add:
   - `DATABASE_URL` = reference the Postgres service's `DATABASE_URL`
   - `JWT_SECRET` = a random 32+ character string
   - `NODE_ENV` = production
   - `CLIENT_URL` = your Netlify URL (add after step 2), e.g. https://my-lifesim.netlify.app
5. Settings > Networking > **Generate Domain**. Copy the URL.
6. Check `https://YOUR-APP.up.railway.app/health` shows ok.
7. Seed the world once. With the Railway CLI: `railway run npm run db:seed` (or use the service's shell).

## 2. Netlify (client)
1. app.netlify.com > Add new site > Import from GitHub > same repo. It reads `netlify.toml`.
2. Site settings > Environment variables: `VITE_SERVER_URL` = your Railway URL (no trailing slash).
3. Deploy. Then put the Netlify URL into Railway's `CLIENT_URL` and redeploy the server.

## Notes
- Keep Railway at ONE instance: players are held in server memory.
- Free/trial limits on both change; check their pricing pages. Railway needs a card or credit after the trial.
- Login tokens are kept in the browser, so there are no cross-site cookie problems.


## Alternative: host the whole game on Railway

The root `railway.json` is set up for a single Railway web service serving both `client/dist` and the API, with PostgreSQL as a separate service in the same project. Add `DATABASE_URL` as a reference to the PostgreSQL service and set a unique `JWT_SECRET` (32+ random characters) plus `NODE_ENV=production`. The first startup runs the schema setup and initializes static game data if the database is empty. Generate a public domain and test `/health` before creating your character.

For this single-service setup, `VITE_SERVER_URL` is not needed. Keep the web service to one replica while Socket.IO presence is stored in process memory.

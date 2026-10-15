/**
 * End-to-end smoke test against a RUNNING server (needs a seeded database).
 *   BASE_URL=http://localhost:5173 npm run smoke
 */
const BASE = process.env.BASE_URL || "http://localhost:5173";
let failed = 0;

async function call(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
function check(name: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`, ok ? "" : JSON.stringify(extra));
  if (!ok) failed++;
}

async function main() {
  const h = await call("GET", "/health");
  check("health", h.status === 200, h);

  const countries = await call("GET", "/api/game/world/countries");
  check("world countries", countries.status === 200 && Array.isArray(countries.data) && countries.data.length > 0, countries);
  const country = countries.data?.[0];
  const states = await call("GET", `/api/game/world/states?country=${country?.code}`);
  const stateList = Array.isArray(states.data) ? states.data : states.data?.states;
  const state = stateList?.[0];
  const cities = await call("GET", `/api/game/world/cities?country=${country?.code}&state=${state?.code ?? state?.stateCode}`);
  const cityList = Array.isArray(cities.data) ? cities.data : cities.data?.cities;
  const city = cityList?.[0];
  check("world cities", !!city, cities);

  const id = Date.now().toString(36);
  const email = `smoke_${id}@example.com`;
  const reg = await call("POST", "/api/auth/register", { username: `smoke${id}`.slice(0, 20), email, password: "smoke-pass-1234" });
  check("register", reg.status < 300 && !!reg.data?.token, reg);
  const token = reg.data?.token;

  const noAuth = await call("GET", "/api/game/bank");
  check("auth required", noAuth.status === 401, noAuth);

  const weak = await call("POST", "/api/auth/register", { username: "x", email: "bad", password: "1" });
  check("register validation rejects bad input", weak.status === 400, weak);

  if (token && city) {
    const cc = await call("POST", "/api/game/character", {
      name: "Smoke Tester", countryCode: country.code,
      stateCode: state.code ?? state.stateCode, cityKey: city.key,
      appearance: { skinTone: 0.5, hairStyle: 0, hairColor: "#332211", facePreset: 0, clothingTop: 0, clothingBottom: 0, accessories: [] },
    }, token);
    check("create character", cc.status < 300, cc);
    const me = await call("GET", "/api/game/character", undefined, token);
    check("character has $500", me.data?.money === 500, me.data);
    const bad = await call("POST", "/api/game/bank/deposit", { amount: -5 }, token);
    check("negative deposit rejected", bad.status === 400, bad);
    const huge = await call("POST", "/api/game/bank/deposit", { amount: 999999 }, token);
    check("overdraft deposit rejected", huge.status >= 400 && huge.status < 500, huge);
    const resolve = await call("POST", "/api/game/competitions/resolve", { competitionId: "x" }, token);
    check("non-admin cannot resolve competitions", resolve.status === 403, resolve);
  }
  console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });

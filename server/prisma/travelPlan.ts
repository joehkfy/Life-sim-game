/**
 * Pure route planner (no database) so it can be unit-tested.
 *
 * The world has ~1,800 cities, so a route between every pair would be millions of rows. Instead:
 *   - bus:   every city <-> its country's capital, cities in the same state, and hub cities
 *            (cities with an airport or station) between each other
 *   - train: between cities that have a station
 *   - plane: between airports in different cities
 * Any city can reach any other in a few hops (city -> capital -> airport -> ...).
 */
export interface CityLite {
  key: string;
  countryId: string;
  stateId: string | null;
}
export interface HubLite {
  code: string;
  cityKey: string;
}
export interface RouteRow {
  fromCityKey: string;
  toCityKey: string;
  mode: "bus" | "train" | "plane";
  durationMins: number;
  price: number;
  fromHubCode: string | null;
  toHubCode: string | null;
}

export function planRoutes(
  cities: CityLite[],
  airports: HubLite[],
  stations: HubLite[],
  capitalByCountry: Record<string, string>
): RouteRow[] {
  const byKey = new Map(cities.map((c) => [c.key, c]));
  const out = new Map<string, RouteRow>();
  const add = (r: RouteRow) => {
    if (r.fromCityKey === r.toCityKey) return;
    out.set(`${r.fromCityKey}|${r.toCityKey}|${r.mode}|${r.fromHubCode ?? ""}|${r.toHubCode ?? ""}`, r);
  };
  const bus = (from: string, to: string, same: boolean, local = false) =>
    add({
      fromCityKey: from,
      toCityKey: to,
      mode: "bus",
      durationMins: local ? 120 : same ? 180 : 720,
      price: local ? 15 : same ? 25 : 90,
      fromHubCode: null,
      toHubCode: null,
    });

  const byState = new Map<string, CityLite[]>();
  for (const c of cities) {
    if (!c.stateId) continue;
    const list = byState.get(c.stateId) || [];
    list.push(c);
    byState.set(c.stateId, list);
  }
  for (const list of byState.values()) {
    for (const a of list) for (const b of list) if (a.key !== b.key) bus(a.key, b.key, true, true);
  }

  for (const c of cities) {
    const cap = capitalByCountry[c.countryId];
    if (cap && cap !== c.key && byKey.has(cap)) {
      bus(c.key, cap, true);
      bus(cap, c.key, true);
    }
  }

  const hubKeys = Array.from(new Set([...airports.map((a) => a.cityKey), ...stations.map((s) => s.cityKey)])).filter((k) => byKey.has(k));
  for (const a of hubKeys) {
    for (const b of hubKeys) {
      if (a === b) continue;
      bus(a, b, byKey.get(a)!.countryId === byKey.get(b)!.countryId);
    }
  }

  for (const a of stations) {
    for (const b of stations) {
      if (a.cityKey === b.cityKey || !byKey.has(a.cityKey) || !byKey.has(b.cityKey)) continue;
      const same = byKey.get(a.cityKey)!.countryId === byKey.get(b.cityKey)!.countryId;
      add({ fromCityKey: a.cityKey, toCityKey: b.cityKey, mode: "train", durationMins: same ? 90 : 360, price: same ? 45 : 120, fromHubCode: a.code, toHubCode: b.code });
    }
  }

  for (const a of airports) {
    for (const b of airports) {
      if (a.cityKey === b.cityKey || !byKey.has(a.cityKey) || !byKey.has(b.cityKey)) continue;
      const same = byKey.get(a.cityKey)!.countryId === byKey.get(b.cityKey)!.countryId;
      add({ fromCityKey: a.cityKey, toCityKey: b.cityKey, mode: "plane", durationMins: same ? 60 : 180, price: same ? 110 : 280, fromHubCode: a.code, toHubCode: b.code });
    }
  }

  return Array.from(out.values());
}

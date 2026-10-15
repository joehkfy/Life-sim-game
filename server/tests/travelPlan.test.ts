import { test } from "node:test";
import assert from "node:assert/strict";
import { planRoutes, type CityLite } from "../prisma/travelPlan";

const cities: CityLite[] = [
  { key: "lagos", countryId: "NG", stateId: "NG-LA" },
  { key: "ikeja", countryId: "NG", stateId: "NG-LA" },
  { key: "kano", countryId: "NG", stateId: "NG-KN" },
  { key: "london", countryId: "GB", stateId: "GB-L" },
  { key: "leeds", countryId: "GB", stateId: "GB-Y" },
];
const airports = [
  { code: "LOS", cityKey: "lagos" },
  { code: "LHR", cityKey: "london" },
];
const capitals = { NG: "lagos", GB: "london" };

test("every city can reach its country's capital (and back) by bus", () => {
  const rows = planRoutes(cities, airports, [], capitals);
  const has = (f: string, t: string, m: string) => rows.some((r) => r.fromCityKey === f && r.toCityKey === t && r.mode === m);
  assert.ok(has("kano", "lagos", "bus") && has("lagos", "kano", "bus"));
  assert.ok(has("leeds", "london", "bus"));
  assert.ok(has("lagos", "ikeja", "bus"));
});

test("planes only connect airport cities, with hub codes", () => {
  const rows = planRoutes(cities, airports, [], capitals);
  const planes = rows.filter((r) => r.mode === "plane");
  assert.equal(planes.length, 2);
  assert.ok(planes.every((p) => p.fromHubCode && p.toHubCode && p.price === 280));
  assert.ok(!rows.some((r) => r.mode === "plane" && (r.fromCityKey === "kano" || r.toCityKey === "kano")));
});

test("buses never need a hub, never loop, and have no duplicates", () => {
  const rows = planRoutes(cities, airports, [], capitals);
  assert.ok(rows.every((r) => r.fromCityKey !== r.toCityKey));
  assert.ok(rows.filter((r) => r.mode === "bus").every((r) => r.fromHubCode === null));
  const ids = rows.map((r) => `${r.fromCityKey}|${r.toCityKey}|${r.mode}|${r.fromHubCode}|${r.toHubCode}`);
  assert.equal(new Set(ids).size, ids.length);
});

test("stays small for a big world (no all-pairs explosion)", () => {
  const big: CityLite[] = [];
  const caps: Record<string, string> = {};
  const hubs: { code: string; cityKey: string }[] = [];
  for (let c = 0; c < 60; c++) for (let s = 0; s < 15; s++) for (let k = 0; k < 2; k++) {
    const key = `c${c}_s${s}_k${k}`;
    big.push({ key, countryId: `C${c}`, stateId: `C${c}-S${s}` });
    if (s === 0 && k === 0) { caps[`C${c}`] = key; hubs.push({ code: `H${c}`, cityKey: key }); }
  }
  const rows = planRoutes(big, hubs, [], caps);
  assert.equal(big.length, 1800);
  assert.ok(rows.length < 20_000, `got ${rows.length} routes`);
});

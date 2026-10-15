import { prisma } from "../../db/client";
import { pushNotification } from "../social/notificationService";
import { withTx, lockCharacters, getCharacter } from "../../util/db";
import { GameError } from "../../util/errors";
import { getLivePosition, relocatePlayer } from "../../network/presence";

export type TravelMode = "plane" | "train" | "bus";

const HUB_RADIUS = 18;

export async function listAirports(countryCode?: string) {
  if (countryCode) {
    const country = await prisma.country.findUnique({ where: { code: countryCode.toUpperCase() } });
    if (!country) return [];
    return prisma.airport.findMany({ where: { countryId: country.id }, orderBy: { name: "asc" } });
  }
  return prisma.airport.findMany({ orderBy: { name: "asc" } });
}

export async function listStations(countryCode?: string) {
  if (countryCode) {
    const country = await prisma.country.findUnique({ where: { code: countryCode.toUpperCase() } });
    if (!country) return [];
    return prisma.trainStation.findMany({ where: { countryId: country.id } });
  }
  return prisma.trainStation.findMany();
}

export async function listRoutes(fromCityKey: string, mode?: string) {
  return prisma.travelRoute.findMany({
    where: { fromCityKey, ...(mode ? { mode } : {}) },
    orderBy: { price: "asc" },
  });
}

export async function getTravelOptions(characterId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId } });
  if (!c) throw new GameError("Character not found");
  const cityKey = c.cityKey || "starter";

  const [routes, cities] = await Promise.all([
    prisma.travelRoute.findMany({ where: { fromCityKey: cityKey }, orderBy: [{ mode: "asc" }, { price: "asc" }] }),
    prisma.city.findMany({ include: { country: true } }),
  ]);
  const byKey = Object.fromEntries(cities.map((x) => [x.key, x]));

  return routes.map((r) => {
    const dest = byKey[r.toCityKey];
    return {
      ...r,
      toCityName: dest?.name || r.toCityKey,
      toCountry: dest?.country?.name,
      toFlag: dest?.country?.flag,
    };
  });
}

/** Travel using a specific route. Plane/train routes require standing at the airport/station. */
export async function takeRoute(characterId: string, routeId: string) {
  const out = await withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const route = await tx.travelRoute.findUnique({ where: { id: routeId } });
    if (!route) throw new GameError("Route not found");
    const c = await getCharacter(tx, characterId);

    const from = c.cityKey || "starter";
    if (route.fromCityKey !== from) {
      throw new GameError(`This route departs from ${route.fromCityKey}. You are in ${from}.`);
    }

    // Hub check. Previously skipped whenever the player was "inside" a building, which let anyone
    // board a plane from anywhere by entering a shop first.
    if ((route.mode === "plane" || route.mode === "train") && route.fromHubCode) {
      const hub =
        route.mode === "plane"
          ? await tx.airport.findUnique({ where: { code: route.fromHubCode } })
          : await tx.trainStation.findUnique({ where: { code: route.fromHubCode } });
      if (hub) {
        if (c.location !== "city") throw new GameError("Step outside first, then go to the departure hub");
        const live = getLivePosition(characterId);
        const px = live ? live.x : c.posX;
        const pz = live ? live.z : c.posZ;
        if (Math.hypot(px - hub.posX, pz - hub.posZ) > HUB_RADIUS) {
          throw new GameError(
            route.mode === "plane" ? `Go to the airport (${hub.name}) to board this flight` : `Go to the train station (${hub.name}) to board`
          );
        }
      }
    }

    if (c.money < route.price) throw new GameError(`Need $${route.price} cash for this ${route.mode}`);

    const destCity = await tx.city.findUnique({ where: { key: route.toCityKey }, include: { country: true } });
    if (!destCity) throw new GameError("Destination city missing");

    let spawnX = 0;
    let spawnZ = 0;
    if (route.mode === "plane" && route.toHubCode) {
      const ap = await tx.airport.findUnique({ where: { code: route.toHubCode } });
      if (ap) { spawnX = ap.posX; spawnZ = ap.posZ; }
    } else if (route.mode === "train" && route.toHubCode) {
      const st = await tx.trainStation.findUnique({ where: { code: route.toHubCode } });
      if (st) { spawnX = st.posX; spawnZ = st.posZ; }
    }

    const updated = await tx.character.update({
      where: { id: characterId },
      data: {
        money: { decrement: route.price },
        cityKey: destCity.key,
        countryCode: destCity.country.code,
        posX: spawnX,
        posZ: spawnZ,
        location: "city",
      },
      select: { money: true },
    });

    return { route, destCity, spawnX, spawnZ, money: updated.money };
  });

  // Keep the live socket session (position, city room) in sync with the new location.
  relocatePlayer(characterId, out.destCity.key, out.spawnX, out.spawnZ);

  const modeLabel = out.route.mode === "plane" ? "Flight" : out.route.mode === "train" ? "Train" : "Bus";
  const msg = `${modeLabel} to ${out.destCity.name}, ${out.destCity.country.flag} ${out.destCity.country.name} (−$${out.route.price})`;
  await pushNotification(characterId, modeLabel + " completed", msg, "info", { routeId, mode: out.route.mode }).catch(() => {});

  return {
    message: msg,
    mode: out.route.mode,
    cityKey: out.destCity.key,
    countryCode: out.destCity.country.code,
    money: out.money,
    spawn: { x: out.spawnX, z: out.spawnZ },
  };
}

/**
 * Legacy "just go to this city" button: takes the cheapest hub-less route (a bus).
 * It can no longer be used to skip airports/stations. If no bus route exists, a flat fee applies.
 */
export async function travelToCity(characterId: string, cityKey: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId } });
  if (!c) throw new GameError("Character not found");
  const from = c.cityKey || "starter";
  if (from === cityKey) throw new GameError("Already in this city");

  const bus = await prisma.travelRoute.findFirst({
    where: { fromCityKey: from, toCityKey: cityKey, fromHubCode: null },
    orderBy: { price: "asc" },
  });
  if (bus) return takeRoute(characterId, bus.id);

  const city = await prisma.city.findUnique({ where: { key: cityKey }, include: { country: true } });
  if (!city) throw new GameError("City not found");
  const cost = 75;

  const money = await withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const cur = await getCharacter(tx, characterId);
    if (cur.money < cost) throw new GameError(`Travel costs $${cost}`);
    const updated = await tx.character.update({
      where: { id: characterId },
      data: { money: { decrement: cost }, cityKey: city.key, countryCode: city.country.code, posX: 0, posZ: 0, location: "city" },
      select: { money: true },
    });
    return updated.money;
  });
  relocatePlayer(characterId, city.key, 0, 0);

  return {
    message: `Traveled to ${city.name}, ${city.country.name} (−$${cost})`,
    cityKey: city.key,
    countryCode: city.country.code,
    money,
  };
}

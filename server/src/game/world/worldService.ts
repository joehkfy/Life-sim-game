import { prisma } from "../../db/client";
import { withTx, lockCharacters, getCharacter } from "../../util/db";
import { GameError } from "../../util/errors";
import { splitPayment } from "../../util/money";
import { assertAdult } from "../../util/life";

export const BUILDING_TYPES = [
  { key: "house", name: "House", cost: 15000, icon: "🏠", description: "A private home" },
  { key: "shop", name: "Shop", cost: 25000, icon: "🏪", description: "Sell goods to players" },
  { key: "cafe", name: "Cafe", cost: 20000, icon: "☕", description: "A small cafe" },
  { key: "office", name: "Office", cost: 35000, icon: "🏢", description: "Work / business space" },
  { key: "studio", name: "Studio", cost: 18000, icon: "🎨", description: "Creative studio" },
  { key: "club", name: "Club", cost: 40000, icon: "🎉", description: "Entertainment venue" },
] as const;

export async function listCountries() {
  return prisma.country.findMany({
    include: {
      cities: {
        select: { id: true, key: true, name: true, mapX: true, mapY: true },
      },
      states: {
        select: { id: true, code: true, name: true, mapX: true, mapY: true },
        orderBy: { name: "asc" },
      },
      _count: { select: { states: true, cities: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function listStatesByCountry(countryCode: string) {
  const country = await prisma.country.findUnique({ where: { code: countryCode.toUpperCase() } });
  if (!country) return [];
  return prisma.state.findMany({
    where: { countryId: country.id },
    include: { cities: { select: { key: true, name: true, mapX: true, mapY: true } } },
    orderBy: { name: "asc" },
  });
}

export async function listCitiesByState(countryCode: string, stateCode: string) {
  const country = await prisma.country.findUnique({ where: { code: countryCode.toUpperCase() } });
  if (!country) return [];
  const state = await prisma.state.findUnique({
    where: { countryId_code: { countryId: country.id, code: stateCode.toUpperCase() } },
  });
  if (!state) {
    // fallback: all cities in country
    return prisma.city.findMany({ where: { countryId: country.id }, orderBy: { name: "asc" } });
  }
  return prisma.city.findMany({ where: { stateId: state.id }, orderBy: { name: "asc" } });
}

export async function listCitiesByCountry(countryCode?: string) {
  if (countryCode) {
    const country = await prisma.country.findUnique({ where: { code: countryCode.toUpperCase() } });
    if (!country) return [];
    return prisma.city.findMany({ where: { countryId: country.id }, orderBy: { name: "asc" } });
  }
  return prisma.city.findMany({ orderBy: { name: "asc" }, include: { country: true } });
}

export async function getWorldSummary() {
  const countries = await listCountries();
  return {
    countries: countries.map((c: any) => ({
      code: c.code,
      name: c.name,
      flag: c.flag,
      currencyCode: c.currencyCode,
      currencySymbol: c.currencySymbol,
      exchangeToUsd: c.exchangeToUsd,
      mapX: c.mapX,
      mapY: c.mapY,
      cities: c.cities,
    })),
    countryCount: countries.length,
    cityCount: countries.reduce((n: number, c: any) => n + (c.cities?.length || 0), 0),
    stateCount: await prisma.state.count(),
  };
}

export async function getCity(cityKey: string) {
  return prisma.city.findUnique({
    where: { key: cityKey },
    include: {
      country: true,
      plots: true,
      buildings: true,
    },
  });
}


/** Owned or rented houses that should have a persistent exterior in this city. */
export async function listCityHomes(cityKey: string) {
  const homes = await prisma.property.findMany({
    where: {
      cityKey,
      OR: [{ ownerId: { not: null } }, { tenantId: { not: null } }],
    },
    orderBy: [{ isStarterHome: "desc" }, { name: "asc" }],
    take: 600,
  });
  const characterIds = Array.from(new Set(
    homes.flatMap((home) => [home.ownerId, home.tenantId]).filter((id): id is string => Boolean(id))
  ));
  const residents = characterIds.length
    ? await prisma.character.findMany({ where: { id: { in: characterIds } }, select: { id: true, name: true } })
    : [];
  const names = new Map<string, string>(residents.map((resident): [string, string] => [resident.id, resident.name]));
  return homes.map((home) => ({
    ...home,
    ownerName: home.ownerId ? names.get(home.ownerId) || "Resident" : null,
    tenantName: home.tenantId ? names.get(home.tenantId) || "Resident" : null,
  }));
}

export async function listCityBuildings(cityKey: string) {
  const city = await prisma.city.findUnique({ where: { key: cityKey } });
  if (!city) throw new GameError("City not found");
  return prisma.playerBuilding.findMany({
    where: { cityId: city.id },
    orderBy: { createdAt: "asc" },
  });
}

export async function listPlots(cityKey: string) {
  const city = await prisma.city.findUnique({ where: { key: cityKey } });
  if (!city) throw new GameError("City not found");
  return prisma.buildPlot.findMany({
    where: { cityId: city.id },
    include: { building: true },
    orderBy: { price: "asc" },
  });
}

export async function buyPlot(characterId: string, plotId: string) {
  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const [c, plot] = await Promise.all([
      getCharacter(tx, characterId),
      tx.buildPlot.findUnique({ where: { id: plotId } }),
    ]);
    if (!plot) throw new GameError("Plot not found");
    assertAdult(c, "buy land");
    const paid = splitPayment(c.money, c.bankBalance, plot.price); // cash first, then bank

    // Atomic claim: only one buyer can win a plot.
    const claimed = await tx.buildPlot.updateMany({ where: { id: plotId, ownerId: null }, data: { ownerId: characterId } });
    if (claimed.count !== 1) throw new GameError("Plot already owned");

    await tx.character.update({ where: { id: characterId }, data: { money: paid.money, bankBalance: paid.bankBalance } });
    return { message: `You bought ${plot.name} for $${plot.price}`, ...paid };
  });
}

export async function myBuildings(characterId: string) {
  return prisma.playerBuilding.findMany({
    where: { ownerId: characterId },
    include: { city: { include: { country: true } }, plot: true },
  });
}

import { prisma } from "../../db/client";
import { withTx, lockCharacters, getCharacter } from "../../util/db";
import { GameError } from "../../util/errors";
import { splitPayment } from "../../util/money";
import { assertAdult } from "../../util/life";
import { relocatePlayer } from "../../network/presence";

export const INTERIORS: Record<string, { name: string; type: string }> = {
  city: { name: "City", type: "world" },
  shop: { name: "General Store", type: "shop" },
  restaurant: { name: "Restaurant", type: "shop" },
  school: { name: "School", type: "school" },
  university: { name: "University", type: "school" },
  hospital: { name: "Hospital", type: "work" },
  police: { name: "Police Station", type: "work" },
  gym: { name: "Gym", type: "activity" },
  apartment_basic: { name: "Apartment", type: "home" },
  house_basic: { name: "House", type: "home" },
};

export async function enterBuilding(characterId: string, locationKey: string) {
  if (!INTERIORS[locationKey] && !locationKey.startsWith("home_")) {
    throw new GameError("Unknown location");
  }

  if (locationKey.startsWith("home_")) {
    const propId = locationKey.replace("home_", "");
    const prop = await prisma.property.findUnique({ where: { id: propId } });
    if (!prop) throw new GameError("Property not found");
    if (prop.ownerId !== characterId && prop.tenantId !== characterId) {
      throw new GameError("You don't have access to this home");
    }
  }

  await prisma.character.update({ where: { id: characterId }, data: { location: locationKey } });

  return {
    location: locationKey,
    name: INTERIORS[locationKey]?.name || "Interior",
    message: `Entered ${INTERIORS[locationKey]?.name || "building"}`,
  };
}

export async function exitToCity(characterId: string) {
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character) throw new GameError("Character not found");

  // Leaving a home returns the character to that home's actual front door, not
  // downtown at (0, 0). This is important because homes are placed persistently.
  const homeId = character.location?.startsWith("home_")
    ? character.location.slice("home_".length)
    : null;
  const home = homeId
    ? await prisma.property.findUnique({ where: { id: homeId } })
    : null;
  const position = home
    ? (home.isStarterHome
      ? { x: home.posX - 4, y: 0, z: home.posZ }
      : { x: home.posX, y: 0, z: home.posZ + 4 })
    : { x: character.posX, y: 0, z: character.posZ };
  // Movement uses yaw 0 for facing -Z. The starter-home door faces west (-X),
  // so +PI/2 points outward; conventional homes face +Z, so PI points outward.
  const exteriorRotation = home?.isStarterHome ? Math.PI / 2 : home ? Math.PI : character.rotationY;

  await prisma.character.update({
    where: { id: characterId },
    data: {
      location: "city",
      posX: position.x,
      posY: 0,
      posZ: position.z,
      rotationY: home ? exteriorRotation : character.rotationY,
    },
  });
  // Keep the live socket session in step with the database (movement checks use the live position).
  relocatePlayer(characterId, character.cityKey || "starter", position.x, position.z);
  return { location: "city", position, rotation: exteriorRotation, message: "You stepped outside into the city." };
}

export async function listProperties() {
  return prisma.property.findMany({ where: { isStarterHome: false }, orderBy: { price: "asc" } });
}

export async function rentProperty(characterId: string, propertyId: string) {
  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const [c, prop] = await Promise.all([
      getCharacter(tx, characterId),
      tx.property.findUnique({ where: { id: propertyId } }),
    ]);
    assertAdult(c, "rent a home");
    if (!prop) throw new GameError("Property not found");
    if (prop.rent <= 0) throw new GameError("This property is for sale only");
    if (c.homeId) {
      const currentHome = await tx.property.findUnique({ where: { id: c.homeId } });
      // A free starter home must not trap a player into living there forever.
      // They may rent elsewhere and keep the starter home as a persistent property.
      if (!currentHome?.isStarterHome) throw new GameError("You already have a home. Move out first.");
    }
    if (c.money < prop.rent) throw new GameError("Not enough cash for first month rent");

    // Atomic claim — two renters can't both get the same flat.
    const claimed = await tx.property.updateMany({
      where: { id: propertyId, ownerId: null, tenantId: null },
      data: { tenantId: characterId },
    });
    if (claimed.count !== 1) throw new GameError("Property is not available");

    const updated = await tx.character.update({
      where: { id: characterId },
      data: { money: { decrement: prop.rent }, homeId: prop.id },
      select: { money: true },
    });
    return { message: `Rented ${prop.name} for $${prop.rent}/month`, homeId: prop.id, money: updated.money };
  });
}

export async function buyProperty(characterId: string, propertyId: string) {
  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const [c, prop] = await Promise.all([
      getCharacter(tx, characterId),
      tx.property.findUnique({ where: { id: propertyId } }),
    ]);
    assertAdult(c, "buy a home");
    if (!prop) throw new GameError("Property not found");
    const paid = splitPayment(c.money, c.bankBalance, prop.price); // cash first, then bank

    const claimed = await tx.property.updateMany({
      where: { id: propertyId, ownerId: null, tenantId: null },
      data: { ownerId: characterId },
    });
    if (claimed.count !== 1) throw new GameError("Property is not available");

    // Moving into the new house ends any tenancy elsewhere (it used to leak the tenant slot).
    if (c.homeId && c.homeId !== prop.id) {
      await tx.property.updateMany({ where: { id: c.homeId, tenantId: characterId }, data: { tenantId: null } });
    }

    await tx.character.update({
      where: { id: characterId },
      data: { money: paid.money, bankBalance: paid.bankBalance, homeId: prop.id },
    });
    return { message: `Purchased ${prop.name} for $${prop.price}`, homeId: prop.id, ...paid };
  });
}

export async function leaveHome(characterId: string) {
  const out = await withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const c = await getCharacter(tx, characterId);
    if (!c.homeId) throw new GameError("You don't have a home");

    const prop = await tx.property.findUnique({ where: { id: c.homeId } });
    if (!prop) {
      await tx.character.update({ where: { id: characterId }, data: { homeId: null, location: "city" } });
      return { message: "Home cleared" };
    }

    // Owners just step outside. (This used to wipe ownership of a house they paid for, with no refund.)
    const position = prop.isStarterHome
      ? { x: prop.posX - 4, y: 0, z: prop.posZ }
      : { x: prop.posX, y: 0, z: prop.posZ + 4 };
    const exteriorRotation = prop.isStarterHome ? Math.PI / 2 : Math.PI;
    if (prop.ownerId === characterId) {
      await tx.character.update({
        where: { id: characterId },
        data: { location: "city", posX: position.x, posY: 0, posZ: position.z, rotationY: exteriorRotation },
      });
      return { message: "You stepped outside. You still own this home.", position };
    }

    if (prop.tenantId === characterId) {
      await tx.property.updateMany({ where: { id: prop.id, tenantId: characterId }, data: { tenantId: null } });
    }
    await tx.character.update({
      where: { id: characterId },
      data: { homeId: null, location: "city", posX: position.x, posY: 0, posZ: position.z, rotationY: exteriorRotation },
    });
    return { message: "You moved out of your home", position };
  });
  if (out.position) {
    const cur = await prisma.character.findUnique({ where: { id: characterId }, select: { cityKey: true } });
    relocatePlayer(characterId, cur?.cityKey || "starter", out.position.x, out.position.z);
  }
  return out;
}

import { prisma } from "../../db/client";
import { GameError } from "../../util/errors";
import { isUniqueViolation } from "../../util/db";
import { currentAge, lifeStageOf } from "../../util/life";
import type {
  CreateCharacterRequest,
  FullCharacter,
  PublicCharacter,
  CharacterAppearance,
  CharacterStats,
  CharacterSkills,
  InventoryItem,
  EquippedItems,
} from "@life-sim/shared";

function toFullCharacter(c: any): FullCharacter {
  return {
    id: c.id,
    userId: c.userId,
    name: c.name,
    age: currentAge(c),
    lifeStage: lifeStageOf(c),
    personality: c.personality,
    appearance: c.appearance as CharacterAppearance,
    position: { x: c.posX, y: c.posY, z: c.posZ },
    rotation: c.rotationY,
    animation: "idle",
    isOnline: true,
    location: c.location || "city",
    cityKey: c.cityKey || "starter",
    countryCode: c.countryCode || "NG",
    stateCode: (c as any).stateCode || "",
    stats: {
      energy: c.energy,
      hunger: c.hunger,
      happiness: c.happiness,
      hygiene: c.hygiene ?? 100,
      health: c.health,
      money: c.money,
      bankBalance: c.bankBalance ?? 0,
    } as CharacterStats,
    skills: {
      intelligence: c.intelligence,
      strength: c.strength,
      charisma: c.charisma,
      creativity: c.creativity,
      cooking: c.cooking,
      fitness: c.fitness,
    } as CharacterSkills,
    jobId: c.jobId,
    jobLevel: c.jobLevel ?? 1,
    jobXp: c.jobXp ?? 0,
    educationLevel: c.educationLevel,
    homeId: c.homeId,
    inventory: (c.inventory as InventoryItem[]) || [],
    equipped: (c.equipped as EquippedItems) || {},
    createdAt: c.createdAt.toISOString(),
    lastLogin: c.lastLogin.toISOString(),
  };
}

function toPublicCharacter(c: any): PublicCharacter {
  return {
    id: c.id,
    name: c.name,
    appearance: c.appearance as CharacterAppearance,
    position: { x: c.posX, y: c.posY, z: c.posZ },
    rotation: c.rotationY,
    animation: "idle",
    isOnline: true,
  };
}

export const STARTING_MONEY = 500;
const HOMES_PER_ROW = 13;
const MAX_STARTER_HOMES_PER_CITY = HOMES_PER_ROW * 100;

export async function createCharacter(userId: string, data: CreateCharacterRequest): Promise<FullCharacter> {
  if (!data.name || data.name.trim().length < 2) {
    throw new GameError("Name must be at least 2 characters");
  }

  // The chosen place has to be real, and the city has to belong to the chosen country/state.
  const countryCode = (data.countryCode || "").toUpperCase();
  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  if (!country) throw new GameError("Unknown country");
  const city = await prisma.city.findUnique({ where: { key: data.cityKey || "" }, include: { state: true } });
  if (!city || city.countryId !== country.id) throw new GameError("That city is not in the selected country");
  const stateCode = city.state?.code || "";
  if (data.stateCode && city.state && city.state.code.toUpperCase() !== data.stateCode.toUpperCase()) {
    throw new GameError("That city is not in the selected state");
  }

  const lifeStage = data.lifeStage === "child" ? "child" : "adult";
  const age = lifeStage === "child" ? Math.min(17, Math.max(5, data.age || 10)) : Math.max(18, Math.min(90, data.age || 22));
  const cityKey = city.key;

  try {
    // One transaction + a per-city advisory lock: two simultaneous sign-ups can't get the same starter-home plot.
    const character = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`starter-home:${cityKey}`}))`;

        const existing = await tx.character.findUnique({ where: { userId } });
        if (existing) throw new GameError("You already have a character");

        const slot = await tx.property.count({ where: { cityKey, isStarterHome: true } });
        if (slot >= MAX_STARTER_HOMES_PER_CITY) {
          throw new GameError("This city has no free starter homes left - pick another city");
        }
        // Thirteen homes per street row; the street extends east as more players join.
        const homeX = 42 + Math.floor(slot / HOMES_PER_ROW) * 12;
        const homeZ = -60 + (slot % HOMES_PER_ROW) * 10;

        const created = await tx.character.create({
          data: {
            userId,
            name: data.name.trim(),
            personality: data.personality || "friendly",
            appearance: data.appearance as any,
            posX: homeX - 4, // the exterior door, kept even while the player is inside
            posY: 0,
            posZ: homeZ,
            rotationY: Math.PI / 2,
            // One game currency for everyone. (Scaling starting cash by exchange rate while every price stayed in
            // dollars made a Nigerian character ~1,500x richer than an American one.)
            money: STARTING_MONEY,
            countryCode: country.code,
            stateCode,
            cityKey,
            lifeStage,
            age,
            location: "city",
            inventory: [],
            equipped: {},
          },
        });

        const home = await tx.property.create({
          data: {
            name: `${created.name}'s Starter Home`,
            type: "house",
            price: 0,
            rent: 0,
            posX: homeX,
            posY: 0,
            posZ: homeZ,
            ownerId: created.id,
            tenantId: null,
            cityKey,
            isStarterHome: true,
            interiorKey: "house_basic",
          },
        });

        return tx.character.update({
          where: { id: created.id },
          data: { homeId: home.id, location: `home_${home.id}` },
        });
      },
      { maxWait: 5000, timeout: 15000 }
    );
    return toFullCharacter(character);
  } catch (e) {
    if (isUniqueViolation(e)) throw new GameError("You already have a character");
    throw e;
  }
}

export async function getCharacterByUserId(userId: string): Promise<FullCharacter | null> {
  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) return null;
  return toFullCharacter(character);
}

export async function getCharacterById(id: string): Promise<FullCharacter | null> {
  const character = await prisma.character.findUnique({ where: { id } });
  if (!character) return null;
  return toFullCharacter(character);
}

export async function updatePosition(
  characterId: string,
  x: number,
  y: number,
  z: number,
  rotationY: number
) {
  await prisma.character.update({
    where: { id: characterId },
    data: { posX: x, posY: y, posZ: z, rotationY, lastLogin: new Date() },
  });
}

export async function saveCharacterStats(characterId: string, stats: Partial<CharacterStats>) {
  await prisma.character.update({
    where: { id: characterId },
    data: {
      energy: stats.energy,
      hunger: stats.hunger,
      happiness: stats.happiness,
      hygiene: stats.hygiene,
      health: stats.health,
      money: stats.money,
    },
  });
}

export { toPublicCharacter, toFullCharacter };

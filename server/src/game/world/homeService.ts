import { randomUUID } from "node:crypto";
import { prisma } from "../../db/client";
import { withTx, lockCharacters, getCharacter, type Tx } from "../../util/db";
import { GameError } from "../../util/errors";

export interface HomeFurniture {
  id: string;
  furnitureKey: string;
  x: number;
  z: number;
  rotation: number;
  isOn?: boolean;
  lastUsedAt?: string;
}

export interface FurnitureDefinition {
  key: string;
  name: string;
  description: string;
  category: "bedroom" | "living" | "entertainment" | "kitchen" | "bathroom" | "lighting" | "study" | "dining";
  price: number;
  icon: string;
  defaultX: number;
  defaultZ: number;
  actions: string[];
}

export const FURNITURE_CATALOG: FurnitureDefinition[] = [
  { key: "bed_basic", name: "Basic Bed", description: "A simple bed for restoring energy.", category: "bedroom", price: 350, icon: "🛏️", defaultX: -6.2, defaultZ: -5.2, actions: ["sleep"] },
  { key: "sofa_basic", name: "Living Room Sofa", description: "A comfortable sofa for relaxing.", category: "living", price: 180, icon: "🛋️", defaultX: -5.2, defaultZ: 3.5, actions: ["relax"] },
  { key: "tv_basic", name: "Television & Stand", description: "Watch television to improve your mood.", category: "entertainment", price: 280, icon: "📺", defaultX: -5.3, defaultZ: 5.8, actions: ["watch_tv"] },
  { key: "fridge_basic", name: "Refrigerator", description: "Grab a quick snack from the fridge.", category: "kitchen", price: 320, icon: "🧊", defaultX: 3.3, defaultZ: -5.2, actions: ["get_snack"] },
  { key: "stove_basic", name: "Kitchen Stove", description: "Prepare a simple meal.", category: "kitchen", price: 240, icon: "🍳", defaultX: 5.2, defaultZ: -5.6, actions: ["cook"] },
  { key: "shower_basic", name: "Shower", description: "Wash up and restore personal hygiene.", category: "bathroom", price: 220, icon: "🚿", defaultX: 7.1, defaultZ: -6.3, actions: ["shower"] },
  { key: "lamp_basic", name: "Floor Lamp", description: "A lamp with a working on/off switch.", category: "lighting", price: 55, icon: "💡", defaultX: 2.2, defaultZ: 3.8, actions: ["toggle"] },
  { key: "desk_basic", name: "Study Desk & Computer", description: "Use the computer to practise skills.", category: "study", price: 160, icon: "🖥️", defaultX: 2.4, defaultZ: 4.9, actions: ["work_on_computer"] },
  { key: "dining_table", name: "Dining Table", description: "A place to sit down and take a break.", category: "dining", price: 210, icon: "🍽️", defaultX: 4.6, defaultZ: 2.5, actions: ["sit"] },
  { key: "bookshelf_basic", name: "Bookshelf", description: "Read and develop creativity.", category: "study", price: 115, icon: "📚", defaultX: -7.7, defaultZ: -3.7, actions: ["read"] },
];

const ACTION_COOLDOWN_MS: Record<string, number> = {
  sleep: 60_000,
  relax: 20_000,
  watch_tv: 20_000,
  get_snack: 15_000,
  cook: 25_000,
  shower: 35_000,
  toggle: 1_000,
  work_on_computer: 30_000,
  read: 25_000,
  sit: 12_000,
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getDef(key: string) {
  const def = FURNITURE_CATALOG.find((f) => f.key === key);
  if (!def) throw new GameError("Unknown furniture item");
  return def;
}

function readFurniture(value: unknown): HomeFurniture[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item: any) =>
    item && typeof item.id === "string" && typeof item.furnitureKey === "string" &&
    Number.isFinite(item.x) && Number.isFinite(item.z) && Number.isFinite(item.rotation)
  ).map((item: any) => ({
    id: item.id,
    furnitureKey: item.furnitureKey,
    x: item.x,
    z: item.z,
    rotation: item.rotation,
    ...(typeof item.isOn === "boolean" ? { isOn: item.isOn } : {}),
    ...(typeof item.lastUsedAt === "string" ? { lastUsedAt: item.lastUsedAt } : {}),
  }));
}

async function accessibleProperty(characterId: string, propertyId: string, tx?: Tx) {
  const client = tx ?? prisma;
  const property = await client.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new GameError("Home not found", 404);
  if (property.ownerId !== characterId && property.tenantId !== characterId) {
    throw new GameError("You don't have access to this home", 403);
  }
  return property;
}

async function lockHome(tx: Tx, propertyId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM properties WHERE id = ${propertyId} FOR UPDATE`;
  if (rows.length === 0) throw new GameError("Home not found", 404);
}

async function editableHome(tx: Tx, characterId: string, propertyId: string) {
  const character = await getCharacter(tx, characterId);
  const property = await accessibleProperty(characterId, propertyId, tx);
  if (character.location !== `home_${propertyId}`) {
    throw new GameError("Enter your home before changing furniture", 409);
  }
  return { character, property, furniture: readFurniture(property.furniture) };
}

function normalisePosition(xValue: unknown, zValue: unknown) {
  const x = Number(xValue);
  const z = Number(zValue);
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 8.5 || Math.abs(z) > 6.5) {
    throw new GameError("Choose a placement inside the house");
  }
  return { x: Math.round(x * 2) / 2, z: Math.round(z * 2) / 2 };
}

function findOpenPosition(items: HomeFurniture[], startX: number, startZ: number, ignoreId?: string) {
  const grid: Array<[number, number]> = [[0, 0]];
  for (let ring = 1; ring <= 5; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      grid.push([dx * 1.5, -ring * 1.5], [dx * 1.5, ring * 1.5]);
    }
    for (let dz = -ring + 1; dz < ring; dz++) {
      grid.push([-ring * 1.5, dz * 1.5], [ring * 1.5, dz * 1.5]);
    }
  }
  for (const [dx, dz] of grid) {
    const x = Math.round((startX + dx) * 2) / 2;
    const z = Math.round((startZ + dz) * 2) / 2;
    if (Math.abs(x) > 8 || Math.abs(z) > 6) continue;
    const occupied = items.some((item) => item.id !== ignoreId && Math.hypot(item.x - x, item.z - z) < 1.2);
    if (!occupied) return { x, z };
  }
  throw new GameError("There isn't enough space here. Move or remove another item first.");
}

export async function getHomeFurniture(characterId: string, propertyId: string) {
  const property = await accessibleProperty(characterId, propertyId);
  return {
    propertyId: property.id,
    propertyName: property.name,
    furniture: readFurniture(property.furniture),
    catalog: FURNITURE_CATALOG,
  };
}

export async function placeFurniture(characterId: string, propertyId: string, furnitureKey: string, xValue?: unknown, zValue?: unknown, rotationValue?: unknown) {
  const def = getDef(furnitureKey);
  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    await lockHome(tx, propertyId);
    const { character, property, furniture } = await editableHome(tx, characterId, propertyId);
    const requested = normalisePosition(xValue ?? def.defaultX, zValue ?? def.defaultZ);
    const position = findOpenPosition(furniture, requested.x, requested.z);
    if (character.money < def.price) throw new GameError(`You need $${def.price} to buy ${def.name}`);
    const rotation = Number.isFinite(Number(rotationValue)) ? Number(rotationValue) : 0;
    const newFurniture: HomeFurniture = {
      id: randomUUID(), furnitureKey: def.key, x: position.x, z: position.z,
      rotation: Math.round(rotation / (Math.PI / 2)) * (Math.PI / 2),
      ...(def.key === "lamp_basic" ? { isOn: true } : {}),
    };
    const updatedFurniture = [...furniture, newFurniture];
    await tx.property.update({ where: { id: property.id }, data: { furniture: updatedFurniture as any } });
    const updatedCharacter = await tx.character.update({
      where: { id: characterId }, data: { money: { decrement: def.price } }, select: { money: true },
    });
    return { message: `${def.name} bought and placed`, money: updatedCharacter.money, furniture: updatedFurniture, placed: newFurniture };
  });
}

export async function moveFurniture(characterId: string, propertyId: string, furnitureId: string, xValue: unknown, zValue: unknown, rotationValue?: unknown) {
  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    await lockHome(tx, propertyId);
    const { property, furniture } = await editableHome(tx, characterId, propertyId);
    const target = furniture.find((item) => item.id === furnitureId);
    if (!target) throw new GameError("Furniture item not found");
    const requested = normalisePosition(xValue, zValue);
    const position = findOpenPosition(furniture, requested.x, requested.z, furnitureId);
    const rotation = Number.isFinite(Number(rotationValue)) ? Number(rotationValue) : target.rotation;
    const updated = furniture.map((item) => item.id === furnitureId
      ? { ...item, x: position.x, z: position.z, rotation: Math.round(rotation / (Math.PI / 2)) * (Math.PI / 2) }
      : item);
    await tx.property.update({ where: { id: property.id }, data: { furniture: updated as any } });
    return { message: "Furniture moved", furniture: updated };
  });
}

export async function removeFurniture(characterId: string, propertyId: string, furnitureId: string) {
  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    await lockHome(tx, propertyId);
    const { property, furniture } = await editableHome(tx, characterId, propertyId);
    const removed = furniture.find((item) => item.id === furnitureId);
    if (!removed) throw new GameError("Furniture item not found");
    const def = getDef(removed.furnitureKey);
    const updated = furniture.filter((item) => item.id !== furnitureId);
    await tx.property.update({ where: { id: property.id }, data: { furniture: updated as any } });
    const refund = Math.floor(def.price * 0.5);
    const character = await tx.character.update({ where: { id: characterId }, data: { money: { increment: refund } }, select: { money: true } });
    return { message: `${def.name} removed. You received a $${refund} resale refund.`, money: character.money, furniture: updated };
  });
}

export async function interactWithFurniture(characterId: string, propertyId: string, furnitureId: string, action: string) {
  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    await lockHome(tx, propertyId);
    const { character, property, furniture } = await editableHome(tx, characterId, propertyId);
    const target = furniture.find((item) => item.id === furnitureId);
    if (!target) throw new GameError("Furniture item not found");
    const def = getDef(target.furnitureKey);
    if (!def.actions.includes(action)) throw new GameError("That action is not available for this item");

    if (action === "toggle") {
      const updated = furniture.map((item) => item.id === target.id ? { ...item, isOn: !(item.isOn ?? true) } : item);
      await tx.property.update({ where: { id: property.id }, data: { furniture: updated as any } });
      return { message: `${def.name} switched ${(updated.find((item) => item.id === target.id)?.isOn) ? "on" : "off"}`, furniture: updated };
    }

    const now = Date.now();
    const lastUsed = target.lastUsedAt ? Date.parse(target.lastUsedAt) : NaN;
    const cooldown = ACTION_COOLDOWN_MS[action] ?? 15_000;
    if (Number.isFinite(lastUsed) && now - lastUsed < cooldown) {
      const seconds = Math.ceil((cooldown - (now - lastUsed)) / 1000);
      throw new GameError(`Take a short break and try again in ${seconds}s`, 429);
    }

    let energy = character.energy;
    let hunger = character.hunger;
    let happiness = character.happiness;
    let hygiene = character.hygiene ?? 100;
    let health = character.health;
    let intelligence = character.intelligence;
    let creativity = character.creativity;
    let cooking = character.cooking;
    let message = "Done";
    switch (action) {
      case "sleep": energy = clamp(energy + 65); happiness = clamp(happiness + 2); message = "You rested in bed and recovered energy."; break;
      case "relax": energy = clamp(energy + 6); happiness = clamp(happiness + 18); message = "You relaxed on the sofa."; break;
      case "watch_tv": energy = clamp(energy - 3); happiness = clamp(happiness + 16); message = "You watched TV and improved your mood."; break;
      case "get_snack": hunger = clamp(hunger - 20); health = clamp(health + 1); message = "You grabbed a snack from the fridge."; break;
      case "cook": hunger = clamp(hunger - 30); energy = clamp(energy - 4); cooking = clamp(cooking + 1); message = "You cooked a simple meal."; break;
      case "shower": hygiene = clamp(hygiene + 65); happiness = clamp(happiness + 3); message = "You took a shower and feel cleaner."; break;
      case "work_on_computer": creativity = clamp(creativity + 2); intelligence = clamp(intelligence + 1); energy = clamp(energy - 4); message = "You spent time learning at your computer."; break;
      case "read": creativity = clamp(creativity + 2); happiness = clamp(happiness + 4); energy = clamp(energy - 2); message = "You read for a while and practised creativity."; break;
      case "sit": energy = clamp(energy + 2); happiness = clamp(happiness + 2); message = "You sat down for a quiet break."; break;
      default: throw new GameError("Unknown action");
    }
    const updatedFurniture = furniture.map((item) => item.id === target.id ? { ...item, lastUsedAt: new Date(now).toISOString() } : item);
    await tx.property.update({ where: { id: property.id }, data: { furniture: updatedFurniture as any } });
    const updatedCharacter = await tx.character.update({
      where: { id: characterId },
      data: { energy, hunger, happiness, hygiene, health, intelligence, creativity, cooking },
      select: { energy: true, hunger: true, happiness: true, hygiene: true, health: true, intelligence: true, creativity: true, cooking: true },
    });
    return { message, stats: updatedCharacter, furniture: updatedFurniture };
  });
}

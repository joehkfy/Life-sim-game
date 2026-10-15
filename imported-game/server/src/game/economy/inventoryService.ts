import { v4 as uuidv4 } from "uuid";
import { getItem } from "../items/catalog";
import type { InventoryItem, EquippedItems, CharacterStats } from "@life-sim/shared";
import { withTx, lockCharacters, getCharacter, type Tx } from "../../util/db";
import { GameError } from "../../util/errors";
import { MAX_BALANCE } from "../../util/money";

const MAX_SLOTS = 100;

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function assertQty(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new GameError("Invalid quantity");
  }
}

function readInv(c: { inventory: unknown }): InventoryItem[] {
  return Array.isArray(c.inventory) ? (c.inventory as InventoryItem[]).map((s) => ({ ...s })) : [];
}

export async function getInventory(characterId: string): Promise<InventoryItem[]> {
  return withTx(async (tx) => readInv(await getCharacter(tx, characterId)));
}

/** Add items. The caller MUST already hold the character lock (lockCharacters) in this transaction. */
export async function addItemTx(tx: Tx, characterId: string, itemKey: string, quantity = 1): Promise<InventoryItem[]> {
  const def = getItem(itemKey);
  if (!def) throw new GameError("Unknown item");
  assertQty(quantity);

  const c = await getCharacter(tx, characterId);
  const inv = readInv(c);

  if (def.stackable) {
    const existing = inv.find((i) => i.itemKey === itemKey);
    const have = existing?.quantity ?? 0;
    // Never silently destroy items that don't fit — fail so the player isn't charged for them.
    if (have + quantity > def.maxStack) {
      throw new GameError(`You can only carry ${def.maxStack} × ${def.name} (you have ${have})`);
    }
    if (existing) existing.quantity = have + quantity;
    else {
      if (inv.length >= MAX_SLOTS) throw new GameError("Your inventory is full");
      inv.push({ id: uuidv4(), itemKey, quantity });
    }
  } else {
    if (inv.length + quantity > MAX_SLOTS) throw new GameError("Your inventory is full");
    for (let i = 0; i < quantity; i++) inv.push({ id: uuidv4(), itemKey, quantity: 1 });
  }

  await tx.character.update({ where: { id: characterId }, data: { inventory: inv as any } });
  return inv;
}

/** Remove items. The caller MUST already hold the character lock in this transaction. */
export async function removeItemTx(tx: Tx, characterId: string, itemKey: string, quantity = 1): Promise<InventoryItem[]> {
  assertQty(quantity);
  const c = await getCharacter(tx, characterId);
  let inv = readInv(c);
  let remaining = quantity;

  inv = inv
    .map((slot) => {
      if (slot.itemKey !== itemKey || remaining <= 0) return slot;
      const take = Math.min(slot.quantity, remaining);
      remaining -= take;
      return { ...slot, quantity: slot.quantity - take };
    })
    .filter((s) => s.quantity > 0);

  if (remaining > 0) throw new GameError("Not enough items");

  await tx.character.update({ where: { id: characterId }, data: { inventory: inv as any } });
  return inv;
}

export async function addItem(characterId: string, itemKey: string, quantity = 1) {
  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    return addItemTx(tx, characterId, itemKey, quantity);
  });
}

export async function removeItem(characterId: string, itemKey: string, quantity = 1) {
  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    return removeItemTx(tx, characterId, itemKey, quantity);
  });
}

export async function useItem(characterId: string, itemKey: string): Promise<{
  inventory: InventoryItem[];
  stats: CharacterStats;
  message: string;
}> {
  const def = getItem(itemKey);
  if (!def) throw new GameError("Unknown item");

  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const c = await getCharacter(tx, characterId);

    const inv = readInv(c);
    const slot = inv.find((i) => i.itemKey === itemKey);
    if (!slot || slot.quantity < 1) throw new GameError("You don't have this item");

    const energy = def.effects.energy ? clamp(c.energy + def.effects.energy) : c.energy;
    const hunger = def.effects.hunger ? clamp(c.hunger + def.effects.hunger) : c.hunger;
    const happiness = def.effects.happiness ? clamp(c.happiness + def.effects.happiness) : c.happiness;
    const health = def.effects.health ? clamp(c.health + def.effects.health) : c.health;

    const shouldConsume = def.category === "food" || def.category === "misc";
    const newInv = shouldConsume ? await removeItemTx(tx, characterId, itemKey, 1) : inv;

    await tx.character.update({ where: { id: characterId }, data: { energy, hunger, happiness, health } });

    return {
      inventory: newInv,
      stats: { energy, hunger, happiness, hygiene: c.hygiene ?? 100, health, money: c.money, bankBalance: c.bankBalance },
      message: `Used ${def.name}`,
    };
  });
}

export async function buyItem(
  characterId: string,
  itemKey: string,
  quantity = 1,
  priceOverride?: number
): Promise<{ inventory: InventoryItem[]; money: number; message: string }> {
  const def = getItem(itemKey);
  if (!def) throw new GameError("Unknown item");
  assertQty(quantity); // negative / fractional quantities used to mint money

  const unit = priceOverride ?? def.price;
  if (!Number.isInteger(unit) || unit < 0) throw new GameError("Invalid price");
  const price = unit * quantity;
  if (price > MAX_BALANCE) throw new GameError("Invalid price");

  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const c = await getCharacter(tx, characterId);
    if (c.money < price) throw new GameError("Not enough money");

    const inventory = await addItemTx(tx, characterId, itemKey, quantity);
    const updated = await tx.character.update({
      where: { id: characterId },
      data: { money: { decrement: price } },
      select: { money: true },
    });

    return { inventory, money: updated.money, message: `Bought ${quantity}x ${def.name} for $${price}` };
  });
}

export async function equipItem(characterId: string, itemKey: string): Promise<EquippedItems> {
  const def = getItem(itemKey);
  if (!def || !def.slot) throw new GameError("This item cannot be equipped");

  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const c = await getCharacter(tx, characterId);
    const inv = readInv(c);
    if (!inv.find((i) => i.itemKey === itemKey)) throw new GameError("You don't own this item");

    const equipped: EquippedItems = { ...((c.equipped as EquippedItems) || {}) };
    equipped[def.slot as keyof EquippedItems] = itemKey as any;

    await tx.character.update({ where: { id: characterId }, data: { equipped: equipped as any } });
    return equipped;
  });
}

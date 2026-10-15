import { prisma } from "../../db/client";
import { getItem } from "../items/catalog";
import { addItemTx, removeItemTx } from "./inventoryService";
import { pushNotification } from "../social/notificationService";
import { withTx, lockCharacters, getCharacter } from "../../util/db";
import { GameError } from "../../util/errors";
import { MAX_TX_AMOUNT, assertRoom } from "../../util/money";

const MAX_ACTIVE_LISTINGS = 20;

export async function listMarket(cityKey?: string) {
  return prisma.marketListing.findMany({
    where: { status: "active", ...(cityKey ? { cityKey } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createListing(sellerId: string, itemKey: string, quantity: number, priceEach: number) {
  const def = getItem(itemKey);
  if (!def) throw new GameError("Unknown item");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new GameError("Invalid quantity");
  if (!Number.isInteger(priceEach) || priceEach < 1 || priceEach > MAX_TX_AMOUNT) {
    throw new GameError("Price must be a whole number of dollars between 1 and " + MAX_TX_AMOUNT);
  }

  // Item removal + listing creation are one transaction: no vanishing items on a crash.
  return withTx(async (tx) => {
    await lockCharacters(tx, [sellerId]);
    const seller = await getCharacter(tx, sellerId);

    const active = await tx.marketListing.count({ where: { sellerId, status: "active" } });
    if (active >= MAX_ACTIVE_LISTINGS) throw new GameError(`You can have at most ${MAX_ACTIVE_LISTINGS} active listings`);

    await removeItemTx(tx, sellerId, itemKey, quantity);
    const listing = await tx.marketListing.create({
      data: { sellerId, itemKey, quantity, priceEach, status: "active", cityKey: seller.cityKey || "starter" },
    });
    return { message: `Listed ${quantity}x ${def.name} at $${priceEach} each`, listing };
  });
}

export async function buyListing(buyerId: string, listingId: string, quantity?: number) {
  const pre = await prisma.marketListing.findUnique({ where: { id: listingId } });
  if (!pre || pre.status !== "active") throw new GameError("Listing not available");
  if (pre.sellerId === buyerId) throw new GameError("Cannot buy your own listing");
  const qty = quantity ?? pre.quantity;
  if (!Number.isInteger(qty) || qty < 1) throw new GameError("Invalid quantity");

  const result = await withTx(async (tx) => {
    await lockCharacters(tx, [buyerId, pre.sellerId]);

    // Atomic claim: only one buyer can take these units, even if several click at once.
    const claimed = await tx.marketListing.updateMany({
      where: { id: listingId, status: "active", quantity: { gte: qty } },
      data: { quantity: { decrement: qty } },
    });
    if (claimed.count !== 1) throw new GameError("Listing no longer available in that quantity");

    const after = await tx.marketListing.findUnique({ where: { id: listingId } });
    if (after && after.quantity === 0) {
      await tx.marketListing.update({ where: { id: listingId }, data: { status: "sold" } });
    }

    const total = pre.priceEach * qty;
    const [buyer, seller] = await Promise.all([getCharacter(tx, buyerId), getCharacter(tx, pre.sellerId)]);
    if (buyer.money < total) throw new GameError("Not enough cash");
    assertRoom(seller.money, total, "cash amount for the seller");

    const updatedBuyer = await tx.character.update({
      where: { id: buyerId },
      data: { money: { decrement: total } },
      select: { money: true },
    });
    await tx.character.update({ where: { id: pre.sellerId }, data: { money: { increment: total } } });
    await addItemTx(tx, buyerId, pre.itemKey, qty); // throws (and rolls everything back) if it doesn't fit

    return { total, money: updatedBuyer.money };
  });

  const def = getItem(pre.itemKey);
  const name = def?.name || pre.itemKey;
  await pushNotification(
    pre.sellerId,
    "Marketplace sale",
    `Sold ${qty}x ${name} for $${result.total}`,
    "market",
    { listingId, total: result.total }
  ).catch((e) => console.error("[market] notification failed", e));

  return { message: `Bought ${qty}x ${name} for $${result.total}`, money: result.money };
}

export async function cancelListing(sellerId: string, listingId: string) {
  return withTx(async (tx) => {
    // Buyers lock the seller too, so once we hold this lock the listing can't change under us.
    await lockCharacters(tx, [sellerId]);
    const listing = await tx.marketListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.sellerId !== sellerId) throw new GameError("Listing not found");
    if (listing.status !== "active") throw new GameError("Already closed");

    await tx.marketListing.update({ where: { id: listingId }, data: { status: "cancelled" } });
    await addItemTx(tx, sellerId, listing.itemKey, listing.quantity);
    return { message: "Listing cancelled — items returned to inventory" };
  });
}

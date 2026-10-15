import { prisma } from "../../db/client";
import { pushNotification } from "../social/notificationService";
import { GameError } from "../../util/errors";
import { withTx, lockCharacters, getCharacter } from "../../util/db";
import { assertRoom, splitPayment } from "../../util/money";
import { assertAdult } from "../../util/life";
import { getLivePosition } from "../../network/presence";

const SKILLS = ["intelligence", "strength", "charisma", "creativity", "cooking", "fitness"] as const;
const MAX_STOCK = 200;

// Lower early-game gates so players can open a shop/company and act as CEO sooner.
export const BUSINESS_TYPES = [
  { key: "restaurant", name: "Restaurant", minSkill: "cooking", minVal: 10, openCost: 3500 },
  { key: "shop", name: "Shop", minSkill: "charisma", minVal: 5, openCost: 2500 },
  { key: "cafe", name: "Cafe", minSkill: "cooking", minVal: 8, openCost: 2000 },
  { key: "club", name: "Club", minSkill: "charisma", minVal: 15, openCost: 6000 },
  { key: "gym", name: "Gym", minSkill: "fitness", minVal: 10, openCost: 4000 },
  { key: "clinic", name: "Clinic", minSkill: "intelligence", minVal: 25, openCost: 8000 },
  { key: "taxi", name: "Taxi Company", minSkill: "fitness", minVal: 5, openCost: 2000 },
  { key: "hotel", name: "Hotel", minSkill: "charisma", minVal: 12, openCost: 10000 },
  { key: "company", name: "Company", minSkill: "intelligence", minVal: 15, openCost: 6000 },
] as const;

const DEFAULT_PRODUCTS: Record<string, { name: string; price: number; skillBoost?: string; skillAmount?: number }[]> = {
  restaurant: [{ name: "Burger Meal", price: 18, skillBoost: "cooking", skillAmount: 0.1 }, { name: "Chef Special", price: 35 }],
  shop: [{ name: "Snack Pack", price: 8 }, { name: "City Souvenir", price: 15 }],
  cafe: [{ name: "Coffee", price: 6 }, { name: "Pastry", price: 9, skillBoost: "cooking", skillAmount: 0.05 }],
  club: [{ name: "Entry Ticket", price: 25 }, { name: "Drink", price: 12 }],
  gym: [{ name: "Day Pass", price: 20, skillBoost: "fitness", skillAmount: 1.5 }],
  clinic: [{ name: "Checkup", price: 40 }],
  taxi: [{ name: "City Ride Voucher", price: 15 }],
  hotel: [{ name: "Room Night", price: 80 }],
  company: [{ name: "Consulting Hour", price: 50 }],
};

function skillOf(c: any, key: string): number {
  return (SKILLS as readonly string[]).includes(key) ? Number(c[key] ?? 0) : 0;
}

function posOf(c: { id: string; posX: number; posZ: number }) {
  const live = getLivePosition(c.id);
  return live ? { x: live.x, z: live.z } : { x: c.posX, z: c.posZ };
}

export async function listBusinessTypes() {
  return BUSINESS_TYPES;
}

export async function listBusinesses(cityKey?: string) {
  return prisma.business.findMany({
    where: cityKey ? { cityKey } : undefined,
    include: { posts: { where: { open: true } }, products: true, _count: { select: { employees: true } } },
    orderBy: { totalRevenue: "desc" },
    take: 100,
  });
}

export async function myBusinesses(ownerId: string) {
  return prisma.business.findMany({ where: { ownerId }, include: { posts: true, employees: true, products: true } });
}

export async function openBusiness(ownerId: string, data: { name: string; type: string; buildingId?: string }) {
  const type = BUSINESS_TYPES.find((t) => t.key === data.type);
  if (!type) throw new GameError("Invalid business type");
  const name = (data.name || "").trim().slice(0, 40);
  if (name.length < 2) throw new GameError("Name your business");

  const out = await withTx(async (tx) => {
    await lockCharacters(tx, [ownerId]);
    const c = await getCharacter(tx, ownerId);
    assertAdult(c, "open a business");
    if (skillOf(c, type.minSkill) < type.minVal) {
      throw new GameError(`Need ${type.minSkill} >= ${type.minVal} to open a ${type.name}`);
    }
    // Counted under the owner's lock, so two parallel requests can't exceed the cap.
    const owned = await tx.business.count({ where: { ownerId } });
    if (owned >= 3) throw new GameError("Max 3 businesses per player");

    const pos = posOf(c);
    let posX = pos.x;
    let posZ = pos.z;
    if (data.buildingId) {
      const b = await tx.playerBuilding.findUnique({ where: { id: data.buildingId } });
      if (!b || b.ownerId !== ownerId) throw new GameError("You don't own that building");
      posX = b.posX;
      posZ = b.posZ;
    }

    const paid = splitPayment(c.money, c.bankBalance, type.openCost);
    await tx.character.update({ where: { id: ownerId }, data: { money: paid.money, bankBalance: paid.bankBalance } });

    const biz = await tx.business.create({
      data: {
        ownerId,
        buildingId: data.buildingId || null,
        name,
        type: type.key,
        description: `A player-owned ${type.name}`,
        cityKey: c.cityKey || "starter",
        posX,
        posZ,
        open: true,
        balance: 0,
      },
    });
    const products = DEFAULT_PRODUCTS[type.key] || DEFAULT_PRODUCTS.shop;
    await tx.businessProduct.createMany({
      data: products.map((p) => ({
        businessId: biz.id,
        name: p.name,
        price: p.price,
        stock: 50,
        skillBoost: p.skillBoost || null,
        skillAmount: p.skillAmount || 0,
      })),
    });
    return { biz, ...paid };
  });

  return { message: `Opened ${type.name} "${name}" (-$${type.openCost})`, business: out.biz, money: out.money, bankBalance: out.bankBalance };
}

export async function postJob(
  ownerId: string,
  businessId: string,
  data: { title?: string; roleKey: string; salary: number; minSkill?: string; minSkillVal?: number }
) {
  const biz = await prisma.business.findUnique({ where: { id: businessId } });
  if (!biz || biz.ownerId !== ownerId) throw new GameError("Not your business");
  if (!Number.isInteger(data.salary) || data.salary < 10 || data.salary > 500) {
    throw new GameError("Salary must be $10-$500 per shift");
  }
  const openPosts = await prisma.businessJobPost.count({ where: { businessId, open: true } });
  if (openPosts >= 10) throw new GameError("You can have at most 10 open job posts per business");

  const title = (data.title || data.roleKey || "Worker").trim().slice(0, 30) || "Worker";
  const post = await prisma.businessJobPost.create({
    data: {
      businessId,
      title,
      roleKey: (data.roleKey || "worker").slice(0, 30) || "worker",
      salary: data.salary,
      minSkill: data.minSkill || null,
      minSkillVal: data.minSkillVal || 0,
      open: true,
    },
  });
  return { message: `Job posted: ${title} @ $${data.salary}/shift`, post };
}

export async function applyToBusiness(characterId: string, postId: string) {
  const out = await withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const post = await tx.businessJobPost.findUnique({ where: { id: postId }, include: { business: true } });
    if (!post || !post.open) throw new GameError("Job not open");
    if (post.business.ownerId === characterId) throw new GameError("Can't hire yourself");

    const c = await getCharacter(tx, characterId);
    assertAdult(c, "take a job");
    if (post.minSkill && skillOf(c, post.minSkill) < post.minSkillVal) {
      throw new GameError(`Need ${post.minSkill} >= ${post.minSkillVal}`);
    }

    const key = { businessId_characterId: { businessId: post.businessId, characterId } };
    const existing = await tx.businessEmployee.findUnique({ where: key });
    if (existing?.active) throw new GameError("Already employed here");

    const emp = await tx.businessEmployee.upsert({
      where: key,
      create: { businessId: post.businessId, characterId, roleKey: post.roleKey, title: post.title, salary: post.salary, active: true },
      update: { roleKey: post.roleKey, title: post.title, salary: post.salary, active: true },
    });
    return { emp, post, name: c.name };
  });

  await pushNotification(out.post.business.ownerId, "New hire", `${out.name} joined ${out.post.business.name} as ${out.post.title}`, "job").catch(() => {});
  return { message: `Hired at ${out.post.business.name} as ${out.post.title} ($${out.post.salary}/shift)`, employee: out.emp };
}

export async function workBusinessShift(characterId: string, businessId: string) {
  const out = await withTx(async (tx) => {
    const emp = await tx.businessEmployee.findUnique({
      where: { businessId_characterId: { businessId, characterId } },
      include: { business: true },
    });
    if (!emp?.active) throw new GameError("You don't work here");

    // Worker AND owner are locked (sorted): the wage is paid out of the owner's money.
    await lockCharacters(tx, [characterId, emp.business.ownerId]);
    const biz = await tx.business.findUnique({ where: { id: businessId } });
    if (!biz) throw new GameError("Business not found");
    if (!biz.open) throw new GameError("Business is closed");

    const [c, owner] = await Promise.all([getCharacter(tx, characterId), getCharacter(tx, biz.ownerId)]);
    if (c.energy < 15) throw new GameError("Too tired");
    if (c.hunger > 85) throw new GameError("Too hungry");

    const p = posOf(c);
    if (Math.hypot(p.x - biz.posX, p.z - biz.posZ) > 15) throw new GameError("Go to the business location to work");

    const pay = emp.salary;
    assertRoom(c.bankBalance, pay, "bank balance");

    // Wage comes from the business drawer first, then the owner's cash/bank. Never minted.
    const fromBiz = Math.min(biz.balance, pay);
    const rest = pay - fromBiz;
    if (rest > 0 && owner.money + owner.bankBalance < rest) {
      throw new GameError("Business/owner can't afford your salary right now");
    }
    if (fromBiz > 0) await tx.business.update({ where: { id: businessId }, data: { balance: { decrement: fromBiz } } });
    if (rest > 0) {
      const paid = splitPayment(owner.money, owner.bankBalance, rest);
      await tx.character.update({ where: { id: biz.ownerId }, data: { money: paid.money, bankBalance: paid.bankBalance } });
    }

    const updated = await tx.character.update({
      where: { id: characterId },
      data: {
        bankBalance: { increment: pay },
        energy: Math.max(0, c.energy - 18),
        hunger: Math.min(100, c.hunger + 10),
        charisma: Math.min(100, c.charisma + 0.15),
      },
      select: { bankBalance: true },
    });
    await tx.bankTransaction.create({ data: { characterId, type: "salary", amount: pay, note: `Salary: ${emp.title} @ ${biz.name}` } });
    return { pay, title: emp.title, bizName: biz.name, bankBalance: updated.bankBalance };
  });

  await pushNotification(characterId, "Shift pay", `$${out.pay} from ${out.bizName} deposited to bank`, "money").catch(() => {});
  return { message: `Worked as ${out.title} at ${out.bizName}. $${out.pay} -> bank`, pay: out.pay, bankBalance: out.bankBalance };
}

export async function buyFromBusiness(buyerId: string, productId: string, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new GameError("Invalid quantity");

  const pre = await prisma.businessProduct.findUnique({ where: { id: productId }, include: { business: true } });
  if (!pre) throw new GameError("Out of stock");
  if (pre.business.ownerId === buyerId) throw new GameError("Can't buy from yourself");

  const out = await withTx(async (tx) => {
    await lockCharacters(tx, [buyerId, pre.business.ownerId]);
    const biz = await tx.business.findUnique({ where: { id: pre.businessId } });
    if (!biz || !biz.open) throw new GameError("Business closed");

    // Atomic stock claim: stock can never go negative, however many people buy at once.
    const claimed = await tx.businessProduct.updateMany({
      where: { id: productId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (claimed.count !== 1) throw new GameError("Out of stock");

    const total = pre.price * quantity;
    const buyer = await getCharacter(tx, buyerId);
    if (buyer.money < total) throw new GameError("Not enough cash");
    assertRoom(biz.balance, total, "business balance");

    const skillUpdates: Record<string, number> = {};
    if (pre.skillBoost && pre.skillAmount) {
      skillUpdates[pre.skillBoost] = Math.min(100, skillOf(buyer, pre.skillBoost) + pre.skillAmount * quantity);
    }
    const updated = await tx.character.update({
      where: { id: buyerId },
      data: {
        money: { decrement: total },
        hunger: Math.max(0, buyer.hunger - 8 * quantity),
        happiness: Math.min(100, buyer.happiness + 5 * quantity),
        ...skillUpdates,
      },
      select: { money: true },
    });
    await tx.business.update({ where: { id: biz.id }, data: { balance: { increment: total }, totalRevenue: { increment: total } } });
    return { total, money: updated.money, bizName: biz.name };
  });

  await pushNotification(pre.business.ownerId, "Sale!", `Someone bought ${quantity}x ${pre.name} for $${out.total} at ${out.bizName}`, "market").catch(() => {});
  return { message: `Bought ${quantity}x ${pre.name} for $${out.total}`, money: out.money };
}

/** Owner buys more stock for their products (a money sink: half the sale price per unit). */
export async function restockProduct(ownerId: string, businessId: string, productId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new GameError("Invalid quantity");
  return withTx(async (tx) => {
    await lockCharacters(tx, [ownerId]);
    const biz = await tx.business.findUnique({ where: { id: businessId } });
    if (!biz || biz.ownerId !== ownerId) throw new GameError("Not your business");
    const product = await tx.businessProduct.findUnique({ where: { id: productId } });
    if (!product || product.businessId !== businessId) throw new GameError("Product not found");
    if (product.stock + quantity > MAX_STOCK) throw new GameError(`Max ${MAX_STOCK} units in stock (you have ${product.stock})`);

    const cost = Math.max(1, Math.round(product.price / 2)) * quantity;
    const owner = await getCharacter(tx, ownerId);
    const paid = splitPayment(owner.money, owner.bankBalance, cost);
    await tx.character.update({ where: { id: ownerId }, data: { money: paid.money, bankBalance: paid.bankBalance } });
    await tx.businessProduct.update({ where: { id: productId }, data: { stock: { increment: quantity } } });
    return { message: `Restocked ${quantity}x ${product.name} (-$${cost})`, ...paid };
  });
}

export async function setBusinessOpen(ownerId: string, businessId: string, open: boolean) {
  const claimed = await prisma.business.updateMany({ where: { id: businessId, ownerId }, data: { open } });
  if (claimed.count !== 1) throw new GameError("Not your business");
  return { message: open ? "Business is open" : "Business closed", open };
}

export async function withdrawBusiness(ownerId: string, businessId: string, amount: number) {
  if (!Number.isInteger(amount) || amount < 1) throw new GameError("Invalid amount");
  return withTx(async (tx) => {
    await lockCharacters(tx, [ownerId]);
    const owner = await getCharacter(tx, ownerId);
    assertRoom(owner.money, amount, "cash amount");

    // Atomic: only succeeds while the drawer really holds that much.
    const claimed = await tx.business.updateMany({
      where: { id: businessId, ownerId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (claimed.count !== 1) throw new GameError("Invalid amount, or not your business");

    const updated = await tx.character.update({ where: { id: ownerId }, data: { money: { increment: amount } }, select: { money: true } });
    return { message: `Withdrew $${amount} from business to cash`, money: updated.money };
  });
}

export async function myEmployment(characterId: string) {
  return prisma.businessEmployee.findMany({ where: { characterId, active: true }, include: { business: true } });
}

export async function quitBusinessJob(characterId: string, businessId: string) {
  await prisma.businessEmployee.updateMany({ where: { characterId, businessId }, data: { active: false } });
  return { message: "You left the job" };
}

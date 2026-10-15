/**
 * Integration tests for the money paths. They need a REAL Postgres (never point this at production):
 *
 *   DATABASE_URL=postgresql://... npm run test:integration -w server
 *
 * They are skipped automatically when DATABASE_URL is not set.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const enabled = !!process.env.DATABASE_URL && process.env.ALLOW_DB_TESTS === "1";
const skip = enabled ? false : "set DATABASE_URL and ALLOW_DB_TESTS=1 to run (uses a real database)";

async function makeChar(prisma: any, tag: string, money: number, bank: number) {
  const n = `${tag}_${Math.random().toString(36).slice(2, 8)}`;
  const user = await prisma.user.create({ data: { username: n, email: `${n}@test.local`, passwordHash: "x" } });
  return prisma.character.create({
    data: {
      userId: user.id, name: n, appearance: {}, money, bankBalance: bank, inventory: [], equipped: {},
    },
  });
}

test("parallel transfers can never overdraw the sender", { skip }, async () => {
  const { prisma } = await import("../src/db/client");
  const { transfer } = await import("../src/game/bank/bankService");
  const a = await makeChar(prisma, "alice", 0, 100);
  const b = await makeChar(prisma, "bob", 0, 0);

  const results = await Promise.allSettled(Array.from({ length: 10 }, () => transfer(a.id, b.id, 60)));
  const ok = results.filter((r) => r.status === "fulfilled").length;
  assert.equal(ok, 1, "only one 60-dollar transfer fits in a 100-dollar balance");

  const [a2, b2] = await Promise.all([
    prisma.character.findUnique({ where: { id: a.id } }),
    prisma.character.findUnique({ where: { id: b.id } }),
  ]);
  assert.equal(a2.bankBalance, 40);
  assert.equal(b2.bankBalance, 60);
});

test("a market listing can only be bought once, however many buyers race", { skip }, async () => {
  const { prisma } = await import("../src/db/client");
  const { createListing, buyListing } = await import("../src/game/economy/marketService");
  const { addItem } = await import("../src/game/economy/inventoryService");
  const seller = await makeChar(prisma, "seller", 0, 0);
  await addItem(seller.id, "apple", 1);
  const { listing } = await createListing(seller.id, "apple", 1, 10);

  const buyers = await Promise.all(Array.from({ length: 8 }, (_, i) => makeChar(prisma, `buyer${i}`, 100, 0)));
  const results = await Promise.allSettled(buyers.map((b) => buyListing(b.id, listing.id, 1)));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);

  const s = await prisma.character.findUnique({ where: { id: seller.id } });
  assert.equal(s.money, 10, "seller is paid exactly once");
});

test("negative quantities can no longer mint money in shops", { skip }, async () => {
  const { prisma } = await import("../src/db/client");
  const { buyItem } = await import("../src/game/economy/inventoryService");
  const c = await makeChar(prisma, "cheater", 100, 0);
  await assert.rejects(() => buyItem(c.id, "burger", -50));
  const after = await prisma.character.findUnique({ where: { id: c.id } });
  assert.equal(after.money, 100);
});

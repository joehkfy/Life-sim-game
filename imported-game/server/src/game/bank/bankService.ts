import { prisma } from "../../db/client";
import { withTx, lockCharacters, getCharacter } from "../../util/db";
import { GameError } from "../../util/errors";
import { assertAmount, assertRoom } from "../../util/money";

export async function getBank(characterId: string) {
  const c = await prisma.character.findUnique({
    where: { id: characterId },
    select: { money: true, bankBalance: true },
  });
  if (!c) throw new GameError("Character not found");
  return c;
}

export async function deposit(characterId: string, amount: number) {
  assertAmount(amount);
  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const c = await getCharacter(tx, characterId);
    if (c.money < amount) throw new GameError("Not enough cash on hand");
    assertRoom(c.bankBalance, amount, "bank balance");

    const updated = await tx.character.update({
      where: { id: characterId },
      data: { money: { decrement: amount }, bankBalance: { increment: amount } },
      select: { money: true, bankBalance: true },
    });
    await tx.bankTransaction.create({ data: { characterId, type: "deposit", amount, note: "Deposit" } });
    return { ...updated, message: `Deposited $${amount}` };
  });
}

export async function withdraw(characterId: string, amount: number) {
  assertAmount(amount);
  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const c = await getCharacter(tx, characterId);
    if (c.bankBalance < amount) throw new GameError("Insufficient bank balance");
    assertRoom(c.money, amount, "cash amount");

    const updated = await tx.character.update({
      where: { id: characterId },
      data: { money: { increment: amount }, bankBalance: { decrement: amount } },
      select: { money: true, bankBalance: true },
    });
    await tx.bankTransaction.create({ data: { characterId, type: "withdraw", amount, note: "Withdraw" } });
    return { ...updated, message: `Withdrew $${amount}` };
  });
}

export async function transfer(fromId: string, toCharacterId: string, amount: number) {
  assertAmount(amount);
  if (fromId === toCharacterId) throw new GameError("Cannot transfer to yourself");

  const recipient = await prisma.character.findUnique({ where: { id: toCharacterId }, select: { id: true } });
  if (!recipient) throw new GameError("Recipient not found");

  return withTx(async (tx) => {
    // Both rows locked (in sorted order) before any balance is read — no double-spend, no deadlock.
    await lockCharacters(tx, [fromId, toCharacterId]);
    const [from, to] = await Promise.all([getCharacter(tx, fromId), getCharacter(tx, toCharacterId)]);
    if (from.bankBalance < amount) throw new GameError("Insufficient bank balance");
    assertRoom(to.bankBalance, amount, "bank balance for the recipient");

    const updated = await tx.character.update({
      where: { id: fromId },
      data: { bankBalance: { decrement: amount } },
      select: { bankBalance: true },
    });
    await tx.character.update({ where: { id: toCharacterId }, data: { bankBalance: { increment: amount } } });
    await tx.bankTransaction.create({
      data: { characterId: fromId, type: "transfer_out", amount, note: `To ${to.name}`, relatedId: toCharacterId },
    });
    await tx.bankTransaction.create({
      data: { characterId: toCharacterId, type: "transfer_in", amount, note: `From ${from.name}`, relatedId: fromId },
    });

    return { bankBalance: updated.bankBalance, message: `Transferred $${amount} to ${to.name}` };
  });
}

export async function recentTransactions(characterId: string, limit = 20) {
  return prisma.bankTransaction.findMany({
    where: { characterId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

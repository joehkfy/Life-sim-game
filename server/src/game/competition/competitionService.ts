import { prisma } from "../../db/client";
import { GameError } from "../../util/errors";
import { pushNotification } from "../social/notificationService";
import { withTx, lockCharacters, lockCompetition, getCharacter } from "../../util/db";
import { assertRoom } from "../../util/money";

/** A round closes this long after its first entry; the server then pays the winner and reopens it. */
export const ROUND_MS = 5 * 60_000;

const DEFAULTS = [
  { key: "city_sprint", name: "City Sprint Race", type: "race", skill: "fitness", entryFee: 20, cityKey: "starter" },
  { key: "strongman", name: "Strongman Challenge", type: "sports", skill: "strength", entryFee: 25, cityKey: "starter" },
  { key: "cooking_cup", name: "Cooking Cup", type: "skill", skill: "cooking", entryFee: 15, cityKey: "starter" },
  { key: "brain_bowl", name: "Brain Bowl", type: "skill", skill: "intelligence", entryFee: 15, cityKey: "starter" },
];
const SKILLS = ["intelligence", "strength", "charisma", "creativity", "cooking", "fitness"];

/** Called once at server start. */
export async function ensureDefaultCompetitions() {
  for (const d of DEFAULTS) {
    await prisma.competition.upsert({ where: { key: d.key }, update: {}, create: { ...d, prizePool: 0, status: "open" } });
  }
}

export async function listCompetitions() {
  return prisma.competition.findMany({
    include: { entries: { orderBy: { score: "desc" } } },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
}

export async function enterCompetition(characterId: string, competitionId: string) {
  return withTx(async (tx) => {
    await lockCompetition(tx, competitionId);
    await lockCharacters(tx, [characterId]);
    const comp = await tx.competition.findUnique({ where: { id: competitionId } });
    if (!comp || comp.status !== "open") throw new GameError("Competition not open");
    if (comp.closesAt && comp.closesAt.getTime() <= Date.now()) {
      throw new GameError("Entries for this round are closed - results are being counted");
    }

    const c = await getCharacter(tx, characterId);
    if (c.money < comp.entryFee) throw new GameError(`Entry fee $${comp.entryFee}`);
    const dup = await tx.competitionEntry.findUnique({ where: { competitionId_characterId: { competitionId, characterId } } });
    if (dup) throw new GameError("Already entered");

    const skillKey = comp.skill && SKILLS.includes(comp.skill) ? comp.skill : "fitness";
    const base = Number((c as any)[skillKey] ?? 10);
    const score = base + Math.random() * 15; // decided on the server, once, at entry

    const closesAt = comp.closesAt ?? new Date(Date.now() + ROUND_MS);
    await tx.character.update({ where: { id: characterId }, data: { money: { decrement: comp.entryFee } } });
    await tx.competition.update({ where: { id: competitionId }, data: { prizePool: { increment: comp.entryFee }, closesAt } });
    await tx.competitionEntry.create({ data: { competitionId, characterId, characterName: c.name, score } });

    return { message: `Entered ${comp.name}. Score: ${score.toFixed(1)}. Results at the end of the round.`, score, closesAt };
  });
}

/**
 * Pays out one round and reopens the competition. Safe to call twice: the second call sees a fresh round.
 * - 0 entries: nothing to do
 * - 1 entry: the fee is refunded (nobody to beat)
 * - 2+ entries: the best score takes the whole pool
 */
export async function resolveCompetition(competitionId: string) {
  const result = await withTx(async (tx) => {
    await lockCompetition(tx, competitionId);
    const comp = await tx.competition.findUnique({ where: { id: competitionId }, include: { entries: { orderBy: { score: "desc" } } } });
    if (!comp) throw new GameError("Competition not found");
    if (comp.entries.length === 0) throw new GameError("No entries yet");

    const winner = comp.entries[0];
    const refund = comp.entries.length === 1;
    const prize = comp.prizePool;

    await lockCharacters(tx, [winner.characterId]);
    const w = await getCharacter(tx, winner.characterId);
    assertRoom(w.money, prize, "cash amount");
    await tx.character.update({ where: { id: winner.characterId }, data: { money: { increment: prize } } });

    await tx.competition.update({
      where: { id: competitionId },
      data: {
        status: "open",
        round: { increment: 1 },
        closesAt: null,
        prizePool: 0,
        lastWinner: refund ? null : winner.characterName,
        lastPrize: refund ? 0 : prize,
      },
    });
    await tx.competitionEntry.deleteMany({ where: { competitionId } });
    return { comp, winner, prize, refund };
  });

  const { comp, winner, prize, refund } = result;
  await pushNotification(
    winner.characterId,
    refund ? "Competition refund" : "Competition win!",
    refund ? `Nobody else entered ${comp.name}; your $${prize} entry fee was refunded.` : `You won ${comp.name} and $${prize}`,
    "info"
  ).catch(() => {});

  return {
    message: refund ? `${comp.name}: only one entry, $${prize} refunded` : `${winner.characterName} won ${comp.name} ($${prize})`,
    winner: refund ? null : winner,
  };
}

/** Background job: close every round whose time is up. */
export async function resolveDueCompetitions() {
  const due = await prisma.competition.findMany({ where: { status: "open", closesAt: { lte: new Date() } }, select: { id: true } });
  for (const d of due) {
    try {
      await resolveCompetition(d.id);
    } catch (e) {
      console.error("[competition] resolve failed", d.id, e);
    }
  }
}

export async function leaderboards() {
  const [richest, businesses, skilled] = await Promise.all([
    // Ranked by net worth (cash + bank), which Prisma's orderBy can't express.
    prisma.$queryRaw<{ id: string; name: string; money: number; bankBalance: number }[]>`
      SELECT id, name, money, "bankBalance" FROM characters
      ORDER BY (money + "bankBalance") DESC LIMIT 15`,
    prisma.business.findMany({
      orderBy: { totalRevenue: "desc" },
      take: 15,
      select: { id: true, name: true, type: true, totalRevenue: true, ownerId: true },
    }),
    prisma.character.findMany({
      orderBy: { fitness: "desc" },
      take: 10,
      select: { id: true, name: true, fitness: true, strength: true, intelligence: true, cooking: true },
    }),
  ]);
  return {
    richest: richest.map((r) => ({ ...r, netWorth: r.money + r.bankBalance })),
    businesses,
    athletes: skilled,
  };
}

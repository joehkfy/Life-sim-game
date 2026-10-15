import { Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { GameError } from "./errors";

export type Tx = Prisma.TransactionClient;

export function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, { maxWait: 5000, timeout: 10000 });
}

/**
 * Row-lock characters for the rest of the transaction (SELECT ... FOR UPDATE).
 * Locks are taken in sorted order so two players paying each other can't deadlock.
 * Every read-modify-write on money, inventory or stats must happen after this.
 */
export async function lockCharacters(tx: Tx, ids: string[]) {
  const sorted = Array.from(new Set(ids)).sort();
  for (const id of sorted) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM characters WHERE id = ${id} FOR UPDATE`;
    if (rows.length === 0) throw new GameError("Character not found");
  }
}

/** Serialise work on one build plot (e.g. two "start construction" calls at once). */
export async function lockPlot(tx: Tx, plotId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM build_plots WHERE id = ${plotId} FOR UPDATE`;
  if (rows.length === 0) throw new GameError("Plot not found");
}

/** Lock order rule: competition first, then characters (so entering and resolving can't deadlock). */
export async function lockCompetition(tx: Tx, competitionId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM competitions WHERE id = ${competitionId} FOR UPDATE`;
  if (rows.length === 0) throw new GameError("Competition not found");
}

export async function getCharacter(tx: Tx, id: string) {
  const c = await tx.character.findUnique({ where: { id } });
  if (!c) throw new GameError("Character not found");
  return c;
}

export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

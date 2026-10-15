import { GameError } from "./errors";

/** Money is stored as whole dollars in Postgres INTEGER columns (no float drift). */
export const MAX_TX_AMOUNT = 100_000_000;
/** Postgres INTEGER max is 2,147,483,647 — stay safely below it. */
export const MAX_BALANCE = 2_000_000_000;

export function assertAmount(amount: unknown): asserts amount is number {
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > MAX_TX_AMOUNT) {
    throw new GameError("Invalid amount (whole dollars only)");
  }
}

export function assertRoom(current: number, add: number, what = "balance") {
  if (current + add > MAX_BALANCE) throw new GameError(`That would exceed the maximum ${what}`);
}

/** Pay from cash first, then bank. Returns the new balances. */
export function splitPayment(money: number, bank: number, amount: number) {
  if (money + bank < amount) throw new GameError(`Not enough money (need $${amount}, cash + bank)`);
  const fromCash = Math.min(money, amount);
  return { money: money - fromCash, bankBalance: bank - (amount - fromCash) };
}

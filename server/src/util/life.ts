import { GameError } from "./errors";

export const ADULT_AGE = 18;
/** Characters age one year every real-world week since they were created. */
export const REAL_DAYS_PER_YEAR = 7;

interface Aging {
  age: number;
  createdAt?: Date | null;
}

export function currentAge(c: Aging): number {
  if (!c.createdAt) return c.age;
  const years = Math.floor((Date.now() - c.createdAt.getTime()) / (REAL_DAYS_PER_YEAR * 24 * 3600 * 1000));
  return c.age + Math.max(0, years);
}

export function lifeStageOf(c: Aging): "child" | "adult" {
  return currentAge(c) >= ADULT_AGE ? "adult" : "child";
}

/** Children can go to school and play, but not run the economy. They grow up over time (see currentAge). */
export function assertAdult(c: Aging, what: string) {
  if (lifeStageOf(c) !== "adult") {
    throw new GameError(`You must be an adult (18+) to ${what}. You are ${currentAge(c)}.`);
  }
}

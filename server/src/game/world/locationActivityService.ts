import { GameError } from "../../util/errors";
import { withTx, lockCharacters, getCharacter } from "../../util/db";
import { splitPayment } from "../../util/money";

type Activity = "heal" | "workout" | "study" | "eat";

const ALLOWED: Record<Activity, string[]> = {
  heal: ["hospital"],
  workout: ["gym"],
  study: ["school", "university"],
  eat: ["restaurant"],
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

/**
 * In-building services: player must already be inside the matching location.
 */
export async function useLocationActivity(characterId: string, action: string) {
  const activity = action as Activity;
  if (!ALLOWED[activity]) throw new GameError("Unknown activity");

  const out = await withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const c = await getCharacter(tx, characterId);
    const loc = c.location || "city";
    if (!ALLOWED[activity].includes(loc) && !ALLOWED[activity].some((k) => loc.includes(k))) {
      throw new GameError(`You must be inside the right building for this (${ALLOWED[activity].join("/")})`);
    }

    if (activity === "heal") {
      if (c.energy < 5) throw new GameError("Too tired for a checkup");
      const cost = 25;
      const paid = splitPayment(c.money, c.bankBalance, cost);
      const health = clamp(c.health + 35);
      const energy = clamp(c.energy - 5);
      const updated = await tx.character.update({
        where: { id: characterId },
        data: { health, energy, money: paid.money, bankBalance: paid.bankBalance },
      });
      return {
        message: `Checkup complete. Health ${health}. (-$${cost})`,
        health: updated.health,
        energy: updated.energy,
        money: updated.money,
        bankBalance: updated.bankBalance,
      };
    }

    if (activity === "workout") {
      if (c.energy < 20) throw new GameError("Too tired to work out. Rest first.");
      if (c.hunger > 85) throw new GameError("Too hungry to train. Eat first.");
      const fitness = clamp((c.fitness ?? 0) + 4, 0, 100);
      const energy = clamp(c.energy - 22);
      const hunger = clamp(c.hunger + 12);
      const health = clamp(c.health + 2);
      const updated = await tx.character.update({
        where: { id: characterId },
        data: { fitness, energy, hunger, health },
      });
      return {
        message: `Solid workout. Fitness ${fitness}. Energy -22.`,
        fitness: updated.fitness,
        energy: updated.energy,
        hunger: updated.hunger,
        health: updated.health,
      };
    }

    if (activity === "study") {
      if (c.energy < 15) throw new GameError("Too tired to study");
      const intelligence = clamp((c.intelligence ?? 0) + 3, 0, 100);
      const energy = clamp(c.energy - 15);
      const happiness = clamp(c.happiness + 2);
      const updated = await tx.character.update({
        where: { id: characterId },
        data: { intelligence, energy, happiness },
      });
      return {
        message: `You studied hard. Intelligence ${intelligence}.`,
        intelligence: updated.intelligence,
        energy: updated.energy,
        happiness: updated.happiness,
      };
    }

    // eat at restaurant
    const cost = 18;
    if (c.money + c.bankBalance < cost) throw new GameError("Not enough money for a meal");
    const paid = splitPayment(c.money, c.bankBalance, cost);
    const hunger = clamp(c.hunger - 40);
    const energy = clamp(c.energy + 8);
    const happiness = clamp(c.happiness + 5);
    const updated = await tx.character.update({
      where: { id: characterId },
      data: {
        hunger,
        energy,
        happiness,
        money: paid.money,
        bankBalance: paid.bankBalance,
      },
    });
    return {
      message: `Meal enjoyed. Hunger down. (-$${cost})`,
      hunger: updated.hunger,
      energy: updated.energy,
      happiness: updated.happiness,
      money: updated.money,
      bankBalance: updated.bankBalance,
    };
  });

  return out;
}

import { prisma } from "../../db/client";
import type { CharacterSkills } from "@life-sim/shared";
import { pushNotification } from "../social/notificationService";
import { withTx, lockCharacters, getCharacter } from "../../util/db";
import { GameError } from "../../util/errors";
import { assertAdult } from "../../util/life";

type SkillGains = Partial<Record<keyof CharacterSkills, number>>;

/** Skill XP per shift, by job category (replaces the old fragile job-name substring matching). */
const CATEGORY_SKILL_GAINS: Record<string, SkillGains> = {
  tech: { intelligence: 0.5, creativity: 0.2 },
  education: { intelligence: 0.5, charisma: 0.2 },
  medical: { intelligence: 0.5 },
  aviation: { intelligence: 0.4 },
  business: { intelligence: 0.3, charisma: 0.3 },
  legal: { intelligence: 0.5, charisma: 0.2 },
  government: { intelligence: 0.2, charisma: 0.3 },
  safety: { fitness: 0.4, strength: 0.3 },
  construction: { strength: 0.3, fitness: 0.2 },
  trades: { strength: 0.2, creativity: 0.2 },
  transport: { fitness: 0.3 },
  maritime: { strength: 0.3, fitness: 0.2 },
  rail: { intelligence: 0.2, fitness: 0.2 },
  hospitality: { charisma: 0.4, cooking: 0.3 },
  retail: { charisma: 0.4 },
  media: { creativity: 0.5, charisma: 0.2 },
  fitness: { fitness: 0.5, strength: 0.3 },
  lifestyle: { creativity: 0.3, charisma: 0.3 },
  agriculture: { strength: 0.3, fitness: 0.3 },
  general: { charisma: 0.2 },
};

export async function listJobs() {
  return prisma.job.findMany();
}

export async function applyForJob(characterId: string, jobId: string) {
  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const [character, job] = await Promise.all([
      getCharacter(tx, characterId),
      tx.job.findUnique({ where: { id: jobId } }),
    ]);
    if (!job) throw new GameError("Job not found");
    assertAdult(character, "take a job");
    if (character.jobId) throw new GameError("You already have a job. Quit first.");

    const reqs = (job.requirements as Partial<CharacterSkills>) || {};
    const skills: CharacterSkills = {
      intelligence: character.intelligence,
      strength: character.strength,
      charisma: character.charisma,
      creativity: character.creativity,
      cooking: character.cooking,
      fitness: character.fitness,
    };
    for (const [key, min] of Object.entries(reqs)) {
      const have = (skills as unknown as Record<string, number>)[key];
      if (min != null && have < min) throw new GameError(`Requires ${key} ≥ ${min} (you have ${have})`);
    }

    await tx.character.update({ where: { id: characterId }, data: { jobId: job.id, jobLevel: 1, jobXp: 0 } });
    return { job };
  }).then(async ({ job }) => {
    await pushNotification(characterId, "You're hired!", `Welcome to your new job: ${job.name}`, "job");
    return { message: `You are now hired as ${job.name}!`, job };
  });
}

export async function quitJob(characterId: string) {
  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const c = await getCharacter(tx, characterId);
    if (!c.jobId) throw new GameError("You don't have a job");

    const activeRole = await tx.constructionRole.findFirst({ where: { workerId: characterId, status: "filled" } });
    if (activeRole) throw new GameError("Finish your current construction job before quitting");

    await tx.character.update({ where: { id: characterId }, data: { jobId: null, jobLevel: 1, jobXp: 0 } });
    return { message: "You quit your job." };
  });
}

export async function workShift(characterId: string) {
  const out = await withTx(async (tx) => {
    // Locked: spamming "work" in parallel can no longer pay out several shifts for one energy check.
    await lockCharacters(tx, [characterId]);
    const c = await tx.character.findUnique({ where: { id: characterId }, include: { job: true } });
    if (!c) throw new GameError("Character not found");
    if (!c.job) throw new GameError("You don't have a job");
    if (c.energy < 20) throw new GameError("Too tired to work. Rest first.");
    if (c.hunger > 80) throw new GameError("Too hungry to work. Eat something.");

    const levelMult = 1 + (c.jobLevel - 1) * 0.15;
    const pay = Math.round(c.job.basePay * levelMult);
    const xpGain = 15 + c.jobLevel * 5;
    const newXp = c.jobXp + xpGain;
    const xpToLevel = c.jobLevel * 100;
    let newLevel = c.jobLevel;
    let finalXp = newXp;
    if (newXp >= xpToLevel && c.jobLevel < (c.job.maxLevel || 5)) {
      newLevel += 1;
      finalXp = newXp - xpToLevel;
    }

    const energy = Math.max(0, c.energy - 25);
    const hunger = Math.min(100, c.hunger + 15);

    const gains = CATEGORY_SKILL_GAINS[c.job.category] || CATEGORY_SKILL_GAINS.general;
    const skillUpdates: Record<string, number> = {};
    for (const [skill, inc] of Object.entries(gains)) {
      const current = (c as unknown as Record<string, number>)[skill];
      skillUpdates[skill] = Math.min(100, current + (inc as number));
    }

    // Salary goes to the BANK (not cash on hand)
    const updated = await tx.character.update({
      where: { id: characterId },
      data: { bankBalance: { increment: pay }, energy, hunger, jobXp: finalXp, jobLevel: newLevel, ...skillUpdates },
      select: { bankBalance: true },
    });
    await tx.bankTransaction.create({
      data: { characterId, type: "salary", amount: pay, note: `Salary: ${c.job.name}` },
    });

    return {
      jobName: c.job.name,
      pay,
      xpGain,
      newLevel,
      leveledUp: newLevel > c.jobLevel,
      bankBalance: updated.bankBalance,
      energy,
      hunger,
    };
  });

  await pushNotification(characterId, "Salary deposited", `$${out.pay} from ${out.jobName} was added to your bank.`, "money", {
    pay: out.pay,
    job: out.jobName,
  }).catch(() => {});
  if (out.leveledUp) {
    await pushNotification(characterId, "Job promotion!", `You reached level ${out.newLevel} as ${out.jobName}.`, "job").catch(() => {});
  }

  return {
    message: `Worked as ${out.jobName}. $${out.pay} deposited to bank.`,
    pay: out.pay,
    xpGain: out.xpGain,
    leveledUp: out.leveledUp,
    newLevel: out.newLevel,
    bankBalance: out.bankBalance,
    energy: out.energy,
    hunger: out.hunger,
  };
}

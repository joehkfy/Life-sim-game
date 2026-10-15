import { prisma } from "../../db/client";
import { GameError } from "../../util/errors";
import { withTx, lockCharacters, getCharacter } from "../../util/db";

type Skill = "intelligence" | "strength" | "charisma" | "creativity" | "cooking" | "fitness";
const SKILLS: Skill[] = ["intelligence", "strength", "charisma", "creativity", "cooking", "fitness"];

export const DEFAULT_COURSES = [
  { key: "basic_math", name: "Basic Math", description: "Numbers and logic", skill: "intelligence", skillGain: 2, cost: 50, duration: 3, minSkill: 0, location: "school" },
  { key: "advanced_science", name: "Advanced Science", description: "University science", skill: "intelligence", skillGain: 4, cost: 150, duration: 5, minSkill: 25, location: "university" },
  { key: "cooking_101", name: "Cooking 101", description: "Kitchen basics", skill: "cooking", skillGain: 3, cost: 80, duration: 3, minSkill: 0, location: "school" },
  { key: "chef_mastery", name: "Chef Mastery", description: "Pro cooking", skill: "cooking", skillGain: 5, cost: 200, duration: 5, minSkill: 25, location: "school" },
  { key: "fitness_bootcamp", name: "Fitness Bootcamp", description: "Get stronger", skill: "fitness", skillGain: 3, cost: 60, duration: 3, minSkill: 0, location: "gym" },
  { key: "strength_training", name: "Strength Training", description: "Build muscle", skill: "strength", skillGain: 3, cost: 70, duration: 4, minSkill: 10, location: "gym" },
  { key: "public_speaking", name: "Public Speaking", description: "Charisma and presence", skill: "charisma", skillGain: 3, cost: 90, duration: 3, minSkill: 0, location: "school" },
  { key: "art_studio", name: "Art Studio", description: "Creative practice", skill: "creativity", skillGain: 3, cost: 75, duration: 3, minSkill: 0, location: "university" },
];

/** Called once at server start (it used to re-upsert every course on every page view). */
export async function ensureCourses() {
  for (const c of DEFAULT_COURSES) {
    await prisma.course.upsert({
      where: { key: c.key },
      update: { name: c.name, description: c.description, skill: c.skill, skillGain: c.skillGain, cost: c.cost, duration: c.duration, minSkill: c.minSkill, location: c.location },
      create: c,
    });
  }
}

export async function listCourses() {
  return prisma.course.findMany({ orderBy: { name: "asc" } });
}

export async function myProgress(characterId: string) {
  return prisma.courseProgress.findMany({ where: { characterId } });
}

export async function attendCourse(characterId: string, courseKey: string) {
  return withTx(async (tx) => {
    await lockCharacters(tx, [characterId]);
    const course = await tx.course.findUnique({ where: { key: courseKey } });
    if (!course) throw new GameError("Course not found");
    if (!SKILLS.includes(course.skill as Skill)) throw new GameError("Course is misconfigured");
    const skill = course.skill as Skill;

    const c = await getCharacter(tx, characterId);
    // Classes happen inside the school / university / gym (enter it from the map first).
    if (c.location !== course.location) throw new GameError(`Go inside the ${course.location} to attend this course`);
    const skillVal = c[skill];
    if (skillVal < course.minSkill) throw new GameError(`Need ${course.skill} >= ${course.minSkill}`);
    if (c.money < course.cost) throw new GameError(`Need $${course.cost}`);
    if (c.energy < 12) throw new GameError("Too tired to study");

    const progress = await tx.courseProgress.findUnique({ where: { characterId_courseKey: { characterId, courseKey } } });
    if (progress?.completed) throw new GameError("Already completed this course");

    const sessions = (progress?.sessions || 0) + 1;
    const completed = sessions >= course.duration;
    const newSkill = Math.min(100, skillVal + course.skillGain);

    await tx.character.update({
      where: { id: characterId },
      data: { money: { decrement: course.cost }, energy: Math.max(0, c.energy - 12), [skill]: newSkill },
    });
    await tx.courseProgress.upsert({
      where: { characterId_courseKey: { characterId, courseKey } },
      create: { characterId, courseKey, sessions, completed },
      update: { sessions, completed },
    });

    return {
      message: completed
        ? `Graduated ${course.name}! ${course.skill} is now ${newSkill.toFixed(1)}`
        : `Attended ${course.name} (${sessions}/${course.duration}). ${course.skill} +${course.skillGain}`,
      sessions,
      completed,
      skill: course.skill,
      skillValue: newSkill,
    };
  });
}

/**
 * Ensures a newly-created Railway/Postgres database has the static game world.
 * Seed scripts are intentionally run only when the database is recognizably empty
 * or only partially seeded, not on every server restart.
 */
import { PrismaClient } from "@prisma/client";
import { spawn } from "node:child_process";

const prisma = new PrismaClient();

function runSeed(): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(command, ["run", "db:seed"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Database seeding failed${code == null ? "" : ` (exit ${code})`}`));
    });
  });
}

async function main() {
  const [countryCount, cityCount, itemCount] = await Promise.all([
    prisma.country.count(),
    prisma.city.count(),
    prisma.item.count(),
  ]);

  // The full world seed creates dozens of countries and over a thousand city records.
  // The small local starter seed alone is not enough for character creation/travel.
  const needsSeed = countryCount < 30 || cityCount < 100 || itemCount === 0;
  if (!needsSeed) {
    console.log(`[db:init] Static world already seeded (${countryCount} countries, ${cityCount} cities, ${itemCount} items).`);
    return;
  }

  console.log(`[db:init] Initializing static game content (${countryCount} countries, ${cityCount} cities, ${itemCount} items found).`);
  await prisma.$disconnect();
  await runSeed();
  console.log("[db:init] Static game content is ready.");
}

main()
  .catch((error) => {
    console.error("[db:init] Failed to initialize game data:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });

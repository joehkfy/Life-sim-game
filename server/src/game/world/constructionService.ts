import { prisma } from "../../db/client";
import { BUILDING_TYPES } from "./worldService";
import { pushNotification } from "../social/notificationService";
import { withTx, lockCharacters, lockPlot, getCharacter, type Tx } from "../../util/db";
import { GameError } from "../../util/errors";
import { splitPayment, assertRoom } from "../../util/money";
import { getLivePosition } from "../../network/presence";
import { assertAdult } from "../../util/life";


/** Roles needed for every build — real players with these jobs can take them */
export const CONSTRUCTION_ROLES = [
  { key: "bricklayer", name: "Bricklayer", jobName: "Bricklayer", share: 0.28 },
  { key: "carpenter", name: "Carpenter", jobName: "Carpenter", share: 0.22 },
  { key: "electrician", name: "Electrician", jobName: "Electrician", share: 0.2 },
  { key: "plumber", name: "Plumber", jobName: "Plumber", share: 0.18 },
  { key: "painter", name: "Painter", jobName: "Painter", share: 0.12 },
] as const;

/** Materials are a money sink; labour is paid to workers OUT OF the owner's escrow (never minted). */
function costs(buildingType: string) {
  const t = BUILDING_TYPES.find((x) => x.key === buildingType);
  const total = t ? t.cost : 20000;
  const materials = Math.round(total * 0.4);
  const roles = CONSTRUCTION_ROLES.map((r) => ({ ...r, pay: Math.round((total - materials) * r.share) }));
  const labour = roles.reduce((sum, r) => sum + r.pay, 0);
  return { materials, labour, roles, escrow: materials + labour };
}

export async function listOpenProjects(cityKey?: string) {
  const where: any = { status: { in: ["hiring", "in_progress"] } };
  if (cityKey) {
    const city = await prisma.city.findUnique({ where: { key: cityKey } });
    if (city) where.cityId = city.id;
  }
  return prisma.constructionProject.findMany({
    where,
    include: { roles: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProject(projectId: string) {
  return prisma.constructionProject.findUnique({
    where: { id: projectId },
    include: { roles: true },
  });
}

/**
 * Owner starts a build on their empty plot.
 * The FULL cost (materials + labour) is held in escrow up front. Workers are paid from it,
 * so construction can no longer create money out of thin air.
 */
export async function startConstruction(ownerId: string, plotId: string, buildingType: string, name: string) {
  const type = BUILDING_TYPES.find((t) => t.key === buildingType);
  if (!type) throw new GameError("Invalid building type");
  const cleanName = (name || "").trim().slice(0, 40);
  if (cleanName.length < 2) throw new GameError("Name your building");

  const plan = costs(buildingType);

  const out = await withTx(async (tx) => {
    await lockCharacters(tx, [ownerId]);
    await lockPlot(tx, plotId);

    const plot = await tx.buildPlot.findUnique({ where: { id: plotId }, include: { building: true } });
    if (!plot) throw new GameError("Plot not found");
    if (plot.ownerId !== ownerId) throw new GameError("You don't own this plot");
    if (plot.building) throw new GameError("Plot already has a finished building");

    const existing = await tx.constructionProject.findFirst({
      where: { plotId, status: { in: ["hiring", "in_progress"] } },
    });
    if (existing) throw new GameError("A construction project is already active on this plot");

    const c = await getCharacter(tx, ownerId);
    assertAdult(c, "order a building");
    if (c.money + c.bankBalance < plan.escrow) {
      throw new GameError(`Need $${plan.escrow} (materials $${plan.materials} + labour $${plan.labour}, held in escrow)`);
    }
    const paid = splitPayment(c.money, c.bankBalance, plan.escrow);
    await tx.character.update({ where: { id: ownerId }, data: { money: paid.money, bankBalance: paid.bankBalance } });

    const proj = await tx.constructionProject.create({
      data: {
        plotId: plot.id,
        cityId: plot.cityId,
        ownerId,
        name: cleanName,
        buildingType: type.key,
        status: "hiring",
        progress: 0,
        materialsPaid: plan.escrow, // total escrow held for this project
        posX: plot.posX,
        posZ: plot.posZ,
      },
    });

    await tx.constructionRole.createMany({
      data: plan.roles.map((role) => ({
        projectId: proj.id,
        roleKey: role.key,
        roleName: role.name,
        pay: role.pay,
        requiredXp: 25,
        progress: 0,
        status: "open",
      })),
    });

    return { project: proj, ...paid };
  });

  const full = await getProject(out.project.id);
  return {
    message: `Construction started for "${out.project.name}". $${plan.escrow} is held in escrow. Hire bricklayers, carpenters, and other trades — they must complete the work before it appears on the map.`,
    project: full,
    money: out.money,
    bankBalance: out.bankBalance,
  };
}

/** Owner cancels a project nobody has started yet and gets the full escrow back. */
export async function cancelConstruction(ownerId: string, projectId: string) {
  return withTx(async (tx) => {
    await lockCharacters(tx, [ownerId]);
    const project = await tx.constructionProject.findUnique({ where: { id: projectId }, include: { roles: true } });
    if (!project || project.ownerId !== ownerId) throw new GameError("Project not found");
    if (project.status !== "hiring" && project.status !== "in_progress") throw new GameError("Project is already closed");
    if (project.roles.some((r) => r.status !== "open")) {
      throw new GameError("Workers have already joined — you can't cancel now");
    }

    const owner = await getCharacter(tx, ownerId);
    assertRoom(owner.money, project.materialsPaid, "cash amount");

    const claimed = await tx.constructionProject.updateMany({
      where: { id: projectId, status: { in: ["hiring", "in_progress"] } },
      data: { status: "cancelled" },
    });
    if (claimed.count !== 1) throw new GameError("Project is already closed");

    const updated = await tx.character.update({
      where: { id: ownerId },
      data: { money: { increment: project.materialsPaid } },
      select: { money: true },
    });
    return { message: `Project cancelled. $${project.materialsPaid} refunded.`, money: updated.money };
  });
}

/** Worker with matching job accepts an open role */
export async function acceptRole(workerId: string, roleId: string) {
  const out = await withTx(async (tx) => {
    await lockCharacters(tx, [workerId]);

    const role = await tx.constructionRole.findUnique({ where: { id: roleId }, include: { project: true } });
    if (!role) throw new GameError("Role not found");
    if (role.status !== "open") throw new GameError("Role is not open");
    if (role.project.status !== "hiring" && role.project.status !== "in_progress") throw new GameError("Project is closed");
    if (role.project.ownerId === workerId) {
      throw new GameError("Hire other players — you can't fill your own construction roles");
    }

    const worker = await tx.character.findUnique({ where: { id: workerId }, include: { job: true } });
    if (!worker) throw new GameError("Character not found");
    if (!worker.job) throw new GameError("You need a construction job to take this role");

    const def = CONSTRUCTION_ROLES.find((r) => r.key === role.roleKey);
    if (!def) throw new GameError("Unknown role");
    if (worker.job.name !== def.jobName) {
      throw new GameError(`This role needs a ${def.jobName}. Your job is ${worker.job.name}.`);
    }

    const busy = await tx.constructionRole.findFirst({ where: { workerId, status: "filled" } });
    if (busy) throw new GameError("Finish your current construction job first");

    // Atomic claim: two workers clicking "accept" at once can't both get the role.
    const claimed = await tx.constructionRole.updateMany({
      where: { id: roleId, status: "open" },
      data: { workerId, status: "filled" },
    });
    if (claimed.count !== 1) throw new GameError("Role is not open");

    await tx.constructionProject.update({ where: { id: role.projectId }, data: { status: "in_progress" } });
    return { role, project: role.project };
  });

  await pushNotification(
    out.project.ownerId,
    "Worker hired",
    `A ${out.role.roleName} joined construction on "${out.project.name}".`,
    "build"
  ).catch(() => {});

  return {
    message: `You took the ${out.role.roleName} job on "${out.project.name}". Go to the site and work shifts to finish it. Pay: $${out.role.pay}`,
    role: out.role,
  };
}

/** Worker does a work shift on their accepted role — adds progress */
export async function workConstruction(workerId: string, roleId: string) {
  const out = await withTx(async (tx) => {
    await lockCharacters(tx, [workerId]);

    const role = await tx.constructionRole.findUnique({ where: { id: roleId }, include: { project: true } });
    if (!role) throw new GameError("Role not found");
    if (role.workerId !== workerId) throw new GameError("Not your role");
    if (role.status === "done") throw new GameError("This role is already finished");
    if (role.status !== "filled") throw new GameError("Role not active");

    const worker = await getCharacter(tx, workerId);
    if (worker.energy < 15) throw new GameError("Too tired — rest first");
    if (worker.hunger > 85) throw new GameError("Too hungry to work");

    // Must be at the site. Use the live position — the DB copy is only flushed periodically.
    const live = getLivePosition(workerId);
    const wx = live ? live.x : worker.posX;
    const wz = live ? live.z : worker.posZ;
    const dx = wx - role.project.posX;
    const dz = wz - role.project.posZ;
    if (Math.sqrt(dx * dx + dz * dz) > 12) throw new GameError("Go to the construction site on the map to work");

    const gain = 8 + (worker.jobLevel || 1) * 2;
    let progress = role.progress + gain;
    let roleDone = false;
    let payMsg = "";

    const energy = Math.max(0, worker.energy - 18);
    const hunger = Math.min(100, worker.hunger + 12);

    if (progress >= role.requiredXp) {
      progress = role.requiredXp;
      roleDone = true;
      assertRoom(worker.money, role.pay, "cash amount");
      // Paid from the owner's escrow (already deducted when the project started).
      await tx.character.update({
        where: { id: workerId },
        data: {
          money: { increment: role.pay },
          energy,
          hunger,
          jobXp: { increment: 20 },
          strength: Math.min(100, worker.strength + 0.3),
          fitness: Math.min(100, worker.fitness + 0.2),
        },
      });
      payMsg = ` Role complete! You earned $${role.pay}.`;
    } else {
      await tx.character.update({ where: { id: workerId }, data: { energy, hunger, jobXp: { increment: 8 } } });
    }

    await tx.constructionRole.update({ where: { id: roleId }, data: { progress, status: roleDone ? "done" : "filled" } });

    const allRoles = await tx.constructionRole.findMany({ where: { projectId: role.projectId } });
    const totalReq = allRoles.reduce((sum, r) => sum + r.requiredXp, 0);
    const totalProg = allRoles.reduce((sum, r) => sum + Math.min(r.progress, r.requiredXp), 0);
    const projectProgress = totalReq > 0 ? (totalProg / totalReq) * 100 : 0;
    const allDone = allRoles.every((r) => r.status === "done");

    if (allDone) {
      await completeProject(tx, role.projectId);
    } else {
      await tx.constructionProject.update({
        where: { id: role.projectId },
        data: { progress: projectProgress, status: "in_progress" },
      });
    }

    return { role, project: role.project, progress, projectProgress, payMsg, complete: allDone };
  });

  if (out.complete) {
    await pushNotification(
      out.project.ownerId,
      "Building complete!",
      `"${out.project.name}" is finished and now on the map.`,
      "build"
    ).catch(() => {});
    return {
      message: `Final work done on "${out.project.name}". Building is complete and now on the map!` + out.payMsg,
      progress: out.progress,
      projectProgress: 100,
      complete: true,
    };
  }

  return {
    message: `Worked as ${out.role.roleName}. Progress ${Math.floor(out.progress)}/${out.role.requiredXp}.` + out.payMsg,
    progress: out.progress,
    projectProgress: out.projectProgress,
    complete: false,
  };
}

async function completeProject(tx: Tx, projectId: string) {
  const project = await tx.constructionProject.findUnique({ where: { id: projectId } });
  if (!project || project.status === "complete") return;

  const existing = await tx.playerBuilding.findUnique({ where: { plotId: project.plotId } });
  if (!existing) {
    await tx.playerBuilding.create({
      data: {
        cityId: project.cityId,
        plotId: project.plotId,
        ownerId: project.ownerId,
        name: project.name,
        buildingType: project.buildingType,
        posX: project.posX,
        posZ: project.posZ,
        interiorKey: project.buildingType === "house" ? "house_basic" : "apartment_basic",
        color: "#6c5ce7",
      },
    });
  }
  await tx.constructionProject.update({ where: { id: projectId }, data: { status: "complete", progress: 100 } });
}

export async function myConstructionWork(characterId: string) {
  return prisma.constructionRole.findMany({
    where: {
      OR: [
        { workerId: characterId, status: { in: ["filled", "done"] } },
        { project: { ownerId: characterId } },
      ],
    },
    include: { project: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

export async function listWorkersByTrade(roleKey: string) {
  const def = CONSTRUCTION_ROLES.find((r) => r.key === roleKey);
  if (!def) return [];
  const job = await prisma.job.findUnique({ where: { name: def.jobName } });
  if (!job) return [];
  return prisma.character.findMany({
    where: { jobId: job.id },
    select: { id: true, name: true, jobLevel: true, appearance: true },
    take: 50,
  });
}

import { prisma } from "../../db/client";
import { GameError } from "../../util/errors";
import { withTx, lockCharacters, getCharacter } from "../../util/db";
import { splitPayment } from "../../util/money";
import { assertAdult } from "../../util/life";
import { getLivePosition } from "../../network/presence";

export const VEHICLE_CATALOG = [
  { type: "bike", name: "City Bike", price: 500, speed: 10, color: "#27ae60" },
  { type: "motorbike", name: "Scooter", price: 2500, speed: 16, color: "#f39c12" },
  { type: "car", name: "Sedan", price: 12000, speed: 22, color: "#2980b9" },
  { type: "sports_car", name: "Sports Car", price: 45000, speed: 32, color: "#c0392b" },
] as const;

const MAX_VEHICLES = 5;

export async function listCatalog() {
  return VEHICLE_CATALOG;
}

export async function myVehicles(ownerId: string) {
  return prisma.vehicle.findMany({ where: { ownerId } });
}

export async function buyVehicle(ownerId: string, type: string) {
  const def = VEHICLE_CATALOG.find((v) => v.type === type);
  if (!def) throw new GameError("Unknown vehicle");

  return withTx(async (tx) => {
    await lockCharacters(tx, [ownerId]);
    const c = await getCharacter(tx, ownerId);
    assertAdult(c, "buy a vehicle");

    const count = await tx.vehicle.count({ where: { ownerId } }); // under the owner's lock, so the cap is real
    if (count >= MAX_VEHICLES) throw new GameError(`Max ${MAX_VEHICLES} vehicles`);

    const paid = splitPayment(c.money, c.bankBalance, def.price);
    await tx.character.update({ where: { id: ownerId }, data: { money: paid.money, bankBalance: paid.bankBalance } });

    const live = getLivePosition(ownerId);
    const vehicle = await tx.vehicle.create({
      data: {
        ownerId,
        type: def.type,
        name: def.name,
        color: def.color,
        speed: def.speed,
        posX: live ? live.x : c.posX,
        posZ: live ? live.z : c.posZ,
        cityKey: c.cityKey || "starter",
      },
    });
    return { message: `Bought ${def.name} for $${def.price}`, vehicle, ...paid };
  });
}

export async function driveVehicle(ownerId: string, vehicleId: string) {
  const v = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!v || v.ownerId !== ownerId) throw new GameError("Not your vehicle");
  await prisma.vehicle.update({ where: { id: vehicleId }, data: { stored: false } });
  return { message: `Driving ${v.name}`, vehicle: v, speed: v.speed };
}

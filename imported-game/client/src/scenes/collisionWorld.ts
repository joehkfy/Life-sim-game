/** Lightweight client-side collision registry for visible city structures.
 * The authoritative server still validates world bounds and movement speed.
 */
import { BUILDINGS } from "@life-sim/shared";

export interface CityBoxCollider {
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
  rotation?: number;
}

export interface HomeCollider {
  id: string;
  x: number;
  z: number;
  rotation: number;
  halfWidth: number;
  halfDepth: number;
}

let cityBoxes: CityBoxCollider[] = [];
let homeBoxes: HomeCollider[] = [];
let interiorFurnitureBoxes: Array<HomeCollider & { propertyId: string }> = [];

export function setCityBoxColliders(colliders: CityBoxCollider[]) {
  cityBoxes = colliders;
}

export function setHomeColliders(colliders: HomeCollider[]) {
  homeBoxes = colliders;
}

export function setInteriorFurnitureColliders(propertyId: string, colliders: HomeCollider[]) {
  interiorFurnitureBoxes = interiorFurnitureBoxes.filter((box) => box.propertyId !== propertyId);
  interiorFurnitureBoxes.push(...colliders.map((box) => ({ ...box, propertyId })));
}

function toLocal(x: number, z: number, box: { x: number; z: number; rotation?: number }) {
  const dx = x - box.x;
  const dz = z - box.z;
  const angle = box.rotation || 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: dx * cos - dz * sin, z: dx * sin + dz * cos };
}

function boxBoundaryScore(x: number, z: number, box: CityBoxCollider | HomeCollider, padding = 0.38) {
  const p = toLocal(x, z, box);
  return Math.max(
    Math.abs(p.x) / (box.halfWidth + padding),
    Math.abs(p.z) / (box.halfDepth + padding),
  );
}

function insideBox(x: number, z: number, box: CityBoxCollider | HomeCollider, padding = 0.38) {
  return boxBoundaryScore(x, z, box, padding) < 1;
}

function crossedHorizontalWall(
  fromX: number, fromZ: number, toX: number, toZ: number,
  wallZ: number, minX: number, maxX: number, thickness = 0.1,
) {
  const crossed = (fromZ < wallZ && toZ >= wallZ) || (fromZ > wallZ && toZ <= wallZ)
    || Math.abs(toZ - wallZ) < thickness;
  if (!crossed) return false;
  const t = Math.abs(toZ - fromZ) < 1e-6 ? 1 : (wallZ - fromZ) / (toZ - fromZ);
  const crossX = fromX + (toX - fromX) * Math.max(0, Math.min(1, t));
  return crossX >= minX && crossX <= maxX;
}

function crossedVerticalWall(
  fromX: number, fromZ: number, toX: number, toZ: number,
  wallX: number, minZ: number, maxZ: number, thickness = 0.1,
) {
  const crossed = (fromX < wallX && toX >= wallX) || (fromX > wallX && toX <= wallX)
    || Math.abs(toX - wallX) < thickness;
  if (!crossed) return false;
  const t = Math.abs(toX - fromX) < 1e-6 ? 1 : (wallX - fromX) / (toX - fromX);
  const crossZ = fromZ + (toZ - fromZ) * Math.max(0, Math.min(1, t));
  return crossZ >= minZ && crossZ <= maxZ;
}

function collidesWithInterior(
  x: number, z: number, fromX: number, fromZ: number, location: string,
) {
  const home = location.startsWith("home_");
  const scale = home ? 0.5 : 1;
  const halfX = 10 * scale;
  const halfZ = 8 * scale;
  const padding = 0.25;
  if (x < -halfX + padding || x > halfX - padding) return true;
  if (z < -halfZ + padding) return true;

  // Keep the doorway as a real passage, while the contextual Exit button
  // performs the saved server-side transition back to the street.
  const doorHalfWidth = (home ? 1.0 : 1.9) * scale;
  if (z > halfZ - 0.12 && Math.abs(x) > doorHalfWidth) return true;
  if (z > halfZ - 0.03) return true;

  if (home) {
    const s = scale;
    const horizontalWalls = [
      { z: -2.25 * s, minX: -10 * s, maxX: -2.8 * s },
      { z: -2.25 * s, minX: 0.4 * s, maxX: 10 * s },
      { z: -6.1 * s, minX: 5.2 * s, maxX: 10 * s },
    ];
    const verticalWalls = [
      { x: -2.4 * s, minZ: -7.775 * s, maxZ: -2.325 * s },
      { x: 5.2 * s, minZ: -7.75 * s, maxZ: -2.55 * s },
    ];
    for (const wall of horizontalWalls) {
      if (crossedHorizontalWall(fromX, fromZ, x, z, wall.z, wall.minX, wall.maxX, 0.09)) return true;
    }
    for (const wall of verticalWalls) {
      if (crossedVerticalWall(fromX, fromZ, x, z, wall.x, wall.minZ, wall.maxZ, 0.09)) return true;
    }
  }
  return false;
}

/** Returns whether a proposed player position is walkable. */
export function canMoveTo(
  x: number,
  z: number,
  location: string,
  fromX: number,
  fromZ: number,
  ignoreFurnitureId?: string,
) {
  if (location && location !== "city") {
    if (collidesWithInterior(x, z, fromX, fromZ, location)) return false;
    if (location.startsWith("home_")) {
      const propertyId = location.slice("home_".length);
      for (const box of interiorFurnitureBoxes) {
        if (box.propertyId !== propertyId || box.id === ignoreFurnitureId || !insideBox(x, z, box, 0.24)) continue;
        const nextScore = boxBoundaryScore(x, z, box, 0.24);
        const currentScore = boxBoundaryScore(fromX, fromZ, box, 0.24);
        // If a save or late furniture load puts the player inside an object,
        // allow escape movement while blocking deeper movement into it.
        if (!insideBox(fromX, fromZ, box, 0.24) || nextScore <= currentScore) return false;
      }
    }
    return true;
  }

  // Collision against the named service buildings. Keep a narrow approach ring
  // around each one so the existing Enter prompt remains reachable.
  for (const building of Object.values(BUILDINGS) as Array<{ x: number; z: number; radius: number }>) {
    if (!building.radius || building.radius <= 0) continue;
    const blockRadius = Math.max(2.2, building.radius - 1.25);
    const nextDistance = Math.hypot(x - building.x, z - building.z);
    const currentDistance = Math.hypot(fromX - building.x, fromZ - building.z);
    if (nextDistance < blockRadius && nextDistance <= currentDistance) return false;
  }

  for (const box of cityBoxes) {
    if (!insideBox(x, z, box, 0.42)) continue;
    // If a save position starts inside a box, allow movement that gets closer
    // to its edge so the player can recover instead of becoming permanently stuck.
    const nextScore = boxBoundaryScore(x, z, box, 0.42);
    const currentScore = boxBoundaryScore(fromX, fromZ, box, 0.42);
    if (nextScore <= currentScore) return false;
  }

  for (const home of homeBoxes) {
    if (!insideBox(x, z, home, 0.35)) continue;
    const from = toLocal(fromX, fromZ, home);
    const to = toLocal(x, z, home);
    // Let a character who is already in the doorway step away from the house.
    const inDoorway = Math.abs(from.x) < 0.9 && from.z >= home.halfDepth - 0.85;
    if (inDoorway && to.z > from.z) continue;
    const nextScore = boxBoundaryScore(x, z, home, 0.35);
    const currentScore = boxBoundaryScore(fromX, fromZ, home, 0.35);
    if (nextScore <= currentScore) return false;
  }
  return true;
}

import { MODELS, worldModel } from "./assetModels";

/**
 * Building catalogue for the city. Each entry has the model's authored size so
 * pickBuilding() can choose the model whose proportions best match a lot, then
 * stretch it to fit exactly (collision boxes stay correct).
 */
export interface KitBuilding {
  url: string;
  w: number;
  h: number;
  d: number;
  /** Rotation (radians) that makes the model's front face +Z, like the old boxes. */
  yaw: number;
}

/** Kenney city kits have their entrances on -Z, so they are turned around by 180 degrees. Set to 0 if doors face away from the street. */
export const KIT_YAW = Math.PI;
/** Your own store / apartment models (front assumed to face +Z). */
export const USER_YAW = 0;

export const USER_STORE: KitBuilding = { url: MODELS.store, w: 5.82, h: 5.77, d: 6.34, yaw: USER_YAW };
export const USER_APARTMENT: KitBuilding = { url: MODELS.apartment, w: 7.63, h: 13.41, d: 6.79, yaw: USER_YAW };

export const COMMERCIAL: KitBuilding[] = [
  { url: worldModel("buildings/commercial/building-a.glb"), w: 0.88, h: 1.29, d: 0.94, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-b.glb"), w: 0.97, h: 1.29, d: 0.94, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-c.glb"), w: 0.88, h: 0.89, d: 1.09, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-d.glb"), w: 0.84, h: 1.29, d: 0.90, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-e.glb"), w: 1.64, h: 0.89, d: 1.01, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-f.glb"), w: 0.84, h: 1.69, d: 1.03, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-g.glb"), w: 0.97, h: 1.69, d: 0.92, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-h.glb"), w: 0.88, h: 1.29, d: 1.01, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-i.glb"), w: 1.24, h: 1.68, d: 1.30, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-j.glb"), w: 2.08, h: 1.69, d: 1.34, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-k.glb"), w: 2.08, h: 1.47, d: 0.94, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-l.glb"), w: 1.37, h: 2.27, d: 1.40, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-m.glb"), w: 1.24, h: 3.15, d: 1.24, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-n.glb"), w: 2.32, h: 2.48, d: 1.82, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-skyscraper-a.glb"), w: 1.36, h: 2.88, d: 1.36, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-skyscraper-b.glb"), w: 1.36, h: 4.48, d: 1.36, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-skyscraper-c.glb"), w: 1.28, h: 4.08, d: 1.39, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-skyscraper-d.glb"), w: 1.28, h: 5.47, d: 1.39, yaw: KIT_YAW },
  { url: worldModel("buildings/commercial/building-skyscraper-e.glb"), w: 1.29, h: 4.08, d: 1.24, yaw: KIT_YAW },
];

export const SUBURBAN: KitBuilding[] = [
  { url: worldModel("buildings/suburban/building-type-a.glb"), w: 1.30, h: 0.83, d: 1.03, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-b.glb"), w: 1.83, h: 1.14, d: 1.14, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-c.glb"), w: 1.29, h: 1.03, d: 1.03, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-d.glb"), w: 1.76, h: 1.24, d: 1.03, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-e.glb"), w: 1.30, h: 1.14, d: 1.03, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-f.glb"), w: 1.43, h: 1.14, d: 1.41, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-g.glb"), w: 1.45, h: 0.77, d: 1.18, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-h.glb"), w: 1.30, h: 0.74, d: 0.92, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-i.glb"), w: 1.29, h: 0.74, d: 1.03, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-j.glb"), w: 1.37, h: 1.04, d: 0.92, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-k.glb"), w: 0.92, h: 1.15, d: 1.02, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-l.glb"), w: 1.03, h: 1.05, d: 1.02, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-m.glb"), w: 1.43, h: 0.74, d: 1.43, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-n.glb"), w: 1.78, h: 1.14, d: 1.38, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-o.glb"), w: 1.27, h: 1.14, d: 1.03, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-p.glb"), w: 1.24, h: 0.92, d: 0.99, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-q.glb"), w: 1.24, h: 0.92, d: 0.89, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-r.glb"), w: 1.03, h: 1.14, d: 1.02, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-s.glb"), w: 1.41, h: 1.14, d: 1.09, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-t.glb"), w: 1.31, h: 1.16, d: 1.41, yaw: KIT_YAW },
  { url: worldModel("buildings/suburban/building-type-u.glb"), w: 1.43, h: 1.14, d: 1.09, yaw: KIT_YAW },
];

/** Distortion = how unevenly the three axes must be scaled (0 = perfect proportions). */
function distortion(b: KitBuilding, w: number, h: number, d: number) {
  const s = [Math.log(w / b.w), Math.log(h / b.h), Math.log(d / b.d)];
  return Math.max(...s) - Math.min(...s);
}

/**
 * Pick the model from `pool` that fits a w x h x d lot with the least stretching.
 * Among the three best matches one is chosen by `seed`, so neighbouring lots differ.
 */
export function pickBuilding(pool: KitBuilding[], w: number, h: number, d: number, seed: number): KitBuilding {
  const ranked = [...pool].sort((a, b) => distortion(a, w, h, d) - distortion(b, w, h, d));
  const top = ranked.slice(0, Math.min(3, ranked.length));
  return top[Math.abs(Math.floor(seed)) % top.length];
}

export type LotKind = "commercial" | "residential";

/** Pool for a lot: low suburban houses where it fits, otherwise commercial buildings (plus your own models). */
export function poolFor(kind: LotKind, floors: number): KitBuilding[] {
  if (kind === "residential" && floors <= 2) return SUBURBAN;
  if (floors >= 5) return [...COMMERCIAL, USER_APARTMENT];
  if (floors <= 2) return [...COMMERCIAL, USER_STORE];
  return [...COMMERCIAL, USER_STORE, USER_APARTMENT];
}

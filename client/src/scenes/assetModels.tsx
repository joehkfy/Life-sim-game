import { Component, Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

/**
 * Shared helpers for loading the 3D asset pack in /public/models/world.
 *
 * Every model is wrapped so the game never breaks if a file is missing or still
 * loading: <ModelOrFallback> renders the original procedural shape until the
 * GLB is ready (and keeps it if the GLB fails to load).
 */

const BASE: string = (import.meta as any).env?.BASE_URL || "/";
export const worldModel = (path: string) => `${BASE}models/world/${path}`;

export const MODELS = {
  // Your own models
  store: worldModel("buildings/convenience-store-01.glb"),
  apartment: worldModel("buildings/apartment-block-01.glb"),
  sedanCustom: worldModel("buildings/car-sedan-01.glb"),
  // Kenney city roads (1x1 tiles, road runs along X)
  roadStraight: worldModel("roads/road-straight.glb"),
  roadCrossroad: worldModel("roads/road-crossroad.glb"),
  // Kenney cars (front faces +Z)
  sedan: worldModel("cars/sedan.glb"),
  sedanSports: worldModel("cars/sedan-sports.glb"),
  hatchback: worldModel("cars/hatchback-sports.glb"),
  suv: worldModel("cars/suv.glb"),
  suvLuxury: worldModel("cars/suv-luxury.glb"),
  taxi: worldModel("cars/taxi.glb"),
  van: worldModel("cars/van.glb"),
  delivery: worldModel("cars/delivery.glb"),
  truck: worldModel("cars/truck.glb"),
  // Kenney nature
  treeOak: worldModel("nature/tree_oak.glb"),
  treeDefault: worldModel("nature/tree_default.glb"),
  treeDetailed: worldModel("nature/tree_detailed.glb"),
  treeFat: worldModel("nature/tree_fat.glb"),
  treePine: worldModel("nature/tree_pineRoundA.glb"),
  palmTall: worldModel("nature/tree_palmTall.glb"),
  palmDetailed: worldModel("nature/tree_palmDetailedTall.glb"),
  bush: worldModel("nature/plant_bush.glb"),
  bushLarge: worldModel("nature/plant_bushLarge.glb"),
  bushDetailed: worldModel("nature/plant_bushDetailed.glb"),
  flowerRed: worldModel("nature/flower_redA.glb"),
  flowerYellow: worldModel("nature/flower_yellowA.glb"),
  flowerPurple: worldModel("nature/flower_purpleA.glb"),
  rockSmallA: worldModel("nature/rock_smallA.glb"),
  rockSmallB: worldModel("nature/rock_smallB.glb"),
  rockLarge: worldModel("nature/rock_largeA.glb"),
  grassLarge: worldModel("nature/grass_large.glb"),
  // Kenney furniture
  bed: worldModel("furniture/bedDouble.glb"),
  sofa: worldModel("furniture/loungeSofa.glb"),
  tvCabinet: worldModel("furniture/cabinetTelevision.glb"),
  tv: worldModel("furniture/televisionModern.glb"),
  fridge: worldModel("furniture/kitchenFridgeLarge.glb"),
  stove: worldModel("furniture/kitchenStove.glb"),
  shower: worldModel("furniture/shower.glb"),
  floorLamp: worldModel("furniture/lampRoundFloor.glb"),
  desk: worldModel("furniture/desk.glb"),
  screen: worldModel("furniture/computerScreen.glb"),
  keyboard: worldModel("furniture/computerKeyboard.glb"),
  deskChair: worldModel("furniture/chairDesk.glb"),
  table: worldModel("furniture/table.glb"),
  chair: worldModel("furniture/chairCushion.glb"),
  bookcase: worldModel("furniture/bookcaseOpen.glb"),
} as const;

export type ModelFit = {
  /** Target size along the model's own X / Y / Z axes (world units). */
  width?: number;
  height?: number;
  depth?: number;
  /**
   * "contain" keeps proportions and fits inside the given box (default).
   * "stretch" scales each axis separately so the model fills the box exactly.
   */
  mode?: "contain" | "stretch";
};

export class AssetBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[assets] model failed to load, using fallback shape", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function FittedModel({ url, fit, yaw = 0, shadows = true }: { url: string; fit?: ModelFit; yaw?: number; shadows?: boolean }) {
  const { scene } = useGLTF(url);
  const { root, scale, offset } = useMemo(() => {
    const root = scene.clone(true);
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = shadows;
        mesh.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const ratios = [
      fit?.width ? fit.width / Math.max(size.x, 1e-4) : null,
      fit?.height ? fit.height / Math.max(size.y, 1e-4) : null,
      fit?.depth ? fit.depth / Math.max(size.z, 1e-4) : null,
    ];
    const given = ratios.filter((r): r is number => r !== null);
    const uniform = given.length ? Math.min(...given) : 1;
    const scale: [number, number, number] =
      fit?.mode === "stretch"
        ? [ratios[0] ?? 1, ratios[1] ?? 1, ratios[2] ?? 1] // axes without a target keep their authored size
        : [uniform, uniform, uniform];
    // Centre on X/Z and rest the base on y = 0 (offset is applied before scaling).
    const offset: [number, number, number] = [-center.x, -box.min.y, -center.z];
    return { root, scale, offset };
  }, [scene, fit?.width, fit?.height, fit?.depth, fit?.mode, shadows]);

  return (
    <group rotation={[0, yaw, 0]}>
      <group scale={scale}>
        <primitive object={root} position={offset} />
      </group>
    </group>
  );
}

/**
 * Renders a GLB fitted to a footprint. `fallback` (the old procedural shape)
 * is shown while the file loads and if it ever fails to load.
 */
export function ModelOrFallback({
  url,
  fit,
  yaw,
  shadows,
  fallback = null,
}: {
  url: string;
  fit?: ModelFit;
  yaw?: number;
  shadows?: boolean;
  fallback?: ReactNode;
}) {
  return (
    <AssetBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <FittedModel url={url} fit={fit} yaw={yaw} shadows={shadows} />
      </Suspense>
    </AssetBoundary>
  );
}

export interface TileInstance {
  x: number;
  z: number;
  rotY: number;
}

function InstancedTilesInner({ url, tiles, size }: { url: string; tiles: TileInstance[]; size: number }) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.InstancedMesh>(null);
  const source = useMemo(() => {
    let found: THREE.Mesh | null = null;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!found && mesh.isMesh) found = mesh;
    });
    return found as THREE.Mesh | null;
  }, [scene]);

  useLayoutEffect(() => {
    const instanced = ref.current;
    if (!instanced || !source) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    // 1x1 tile scaled to `size` on X/Z; height stays as authored (tiles are ~flat).
    const s = new THREE.Vector3(size, 1, size);
    tiles.forEach((tile, i) => {
      q.setFromAxisAngle(up, tile.rotY);
      p.set(tile.x, 0, tile.z);
      m.compose(p, q, s);
      instanced.setMatrixAt(i, m);
    });
    instanced.instanceMatrix.needsUpdate = true;
  }, [tiles, size, source]);

  if (!source) throw new Error("[assets] tile model has no mesh: " + url);
  return (
    <instancedMesh
      ref={ref}
      args={[source.geometry, source.material as THREE.Material, tiles.length]}
      frustumCulled={false}
      receiveShadow
    />
  );
}

/** Draws many copies of one flat tile model with a single draw call. */
export function InstancedTiles({
  url,
  tiles,
  size,
  fallback = null,
}: {
  url: string;
  tiles: TileInstance[];
  size: number;
  fallback?: ReactNode;
}) {
  return (
    <AssetBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <InstancedTilesInner url={url} tiles={tiles} size={size} />
      </Suspense>
    </AssetBoundary>
  );
}

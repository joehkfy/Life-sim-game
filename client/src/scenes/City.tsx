import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { BUILDINGS } from "@life-sim/shared";
import { useGameStore } from "../stores/gameStore";
import { setCityBoxColliders } from "./collisionWorld";
import { InstancedTiles, MODELS, ModelOrFallback, type TileInstance } from "./assetModels";
import { USER_APARTMENT, USER_STORE, COMMERCIAL, pickBuilding, poolFor } from "./buildingKits";

/** Main avenue tiles (Kenney road kit): 10 m tiles, road runs along X, rotated 90° for the N/S avenue. */
const AVENUE_TILE = 10;
const AVENUE_TILES: TileInstance[] = (() => {
  const list: TileInstance[] = [];
  for (let i = -35; i <= 35; i++) {
    if (i === 0) continue;
    list.push({ x: i * AVENUE_TILE, z: 0, rotY: 0 });
    list.push({ x: 0, z: i * AVENUE_TILE, rotY: Math.PI / 2 });
  }
  return list;
})();

function CityTree({ kind, mobile, index }: { kind: LayoutKind; mobile: boolean; index: number }) {
  const tropical = kind === "tropical";
  const arid = kind === "arid";
  const pool = tropical
    ? [MODELS.palmTall, MODELS.palmDetailed, MODELS.treeFat]
    : arid
      ? [MODELS.palmDetailed, MODELS.treeDefault]
      : kind === "classic"
        ? [MODELS.treeOak, MODELS.treeDetailed, MODELS.treePine]
        : [MODELS.treeOak, MODELS.treeDefault, MODELS.treeDetailed, MODELS.treeFat];
  const url = pool[index % pool.length];
  const height = tropical ? 5.2 : 4.2;
  const fallback = (
    <group>
      <mesh position={[0, tropical ? 1.1 : 0.6, 0]} castShadow={!mobile}>
        <cylinderGeometry args={[tropical ? 0.12 : 0.15, tropical ? 0.18 : 0.2, tropical ? 2.2 : 1.2, 6]} />
        <meshStandardMaterial color="#5c4030" />
      </mesh>
      <mesh position={[0, tropical ? 2.5 : 1.6, 0]} castShadow={!mobile}>
        <sphereGeometry args={[tropical ? 1.15 : 0.9, mobile ? 6 : 10, mobile ? 6 : 10]} />
        <meshStandardMaterial color={arid ? "#5a6b3a" : "#2d6b3a"} />
      </mesh>
    </group>
  );
  return <ModelOrFallback url={url} fit={{ height }} yaw={(index * 2.399) % (Math.PI * 2)} shadows={!mobile} fallback={fallback} />;
}

/** Bushes, flowers and rocks around the central park (Kenney nature kit). */
function ParkDecor({ radius, seed, mobile }: { radius: number; seed: number; mobile: boolean }) {
  const items = useMemo(() => {
    const list: { url: string; x: number; z: number; h: number; yaw: number }[] = [];
    const bushes = [MODELS.bush, MODELS.bushLarge, MODELS.bushDetailed];
    const flowers = [MODELS.flowerRed, MODELS.flowerYellow, MODELS.flowerPurple];
    const rocks = [MODELS.rockSmallA, MODELS.rockSmallB, MODELS.rockLarge];
    const nBush = mobile ? 6 : 14;
    const nFlower = mobile ? 8 : 20;
    const nRock = mobile ? 2 : 6;
    const place = (n: number, pool: string[], h: number, rMin: number, rMax: number, salt: number) => {
      for (let i = 0; i < n; i++) {
        const a = rand(seed + salt + i * 7) * Math.PI * 2;
        const d = radius * (rMin + rand(seed + salt + i * 13) * (rMax - rMin));
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d;
        // Keep the crossing stone paths (|x| or |z| < 1.2) and bench area clear.
        if (Math.abs(x) < 1.6 || Math.abs(z) < 1.6) continue;
        list.push({ url: pool[i % pool.length], x, z, h, yaw: rand(seed + salt + i) * Math.PI * 2 });
      }
    };
    place(nBush, bushes, 1.1, 0.35, 0.95, 500);
    place(nFlower, flowers, 0.5, 0.25, 0.9, 700);
    place(nRock, rocks, 0.7, 0.5, 0.95, 900);
    return list;
  }, [radius, seed, mobile]);
  return (
    <group>
      {items.map((it, i) => (
        <group key={i} position={[it.x, 0.03, it.z]}>
          <ModelOrFallback url={it.url} fit={{ height: it.h }} yaw={it.yaw} shadows={false} />
        </group>
      ))}
    </group>
  );
}

/** Distinct landmark colors so hospital/school/etc are readable on the map. */
const LANDMARK_STYLE: Record<string, { color: string; accent: string; floors: number; w: number; d: number }> = {
  shop: { color: "#6b5b95", accent: "#f0c14b", floors: 3, w: 8, d: 7 },
  restaurant: { color: "#c45c48", accent: "#f5e6c8", floors: 3, w: 8, d: 7 },
  school: { color: "#3d7ea6", accent: "#e8f0f8", floors: 5, w: 12, d: 10 },
  university: { color: "#2f5d8a", accent: "#d4e4f7", floors: 8, w: 14, d: 11 },
  hospital: { color: "#e8eef4", accent: "#d64545", floors: 10, w: 12, d: 10 },
  police: { color: "#2c3e6b", accent: "#f0c14b", floors: 5, w: 9, d: 8 },
  gym: { color: "#3a7d6a", accent: "#b8f0d8", floors: 4, w: 9, d: 8 },
  apartments: { color: "#8a7b6a", accent: "#d4c4b0", floors: 14, w: 10, d: 9 },
};

function isMobile() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 900 || "ontouchstart" in window;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

type BuildStyle = "modern" | "brick" | "glass" | "classic" | "shop";
type LayoutKind = "dense" | "suburban" | "coastal" | "arid" | "tropical" | "classic";

type CityTheme = {
  ground: string;
  road: string;
  grass: string;
  skyHint: string;
  styles: BuildStyle[];
};

type LayoutProfile = {
  kind: LayoutKind;
  /** Block centers for procedural buildings */
  blocks: [number, number][];
  /** Local street offsets on X and Z (in addition to main cross at 0) */
  streets: number[];
  minFloors: number;
  maxFloors: number;
  widthMin: number;
  widthSpan: number;
  depthMin: number;
  depthSpan: number;
  parkRadius: number;
  treeCount: number;
};

/** Country → default layout. Cities inherit this unless overridden. */
const COUNTRY_LAYOUT: Record<string, LayoutKind> = {
  NG: "tropical", GH: "tropical", KE: "tropical", ZA: "suburban", EG: "arid",
  US: "dense", CA: "suburban", MX: "tropical", BR: "tropical", AR: "suburban",
  GB: "classic", FR: "classic", DE: "classic", IT: "classic", ES: "classic",
  NL: "classic", SE: "suburban", NO: "suburban", PL: "classic", TR: "dense",
  JP: "dense", CN: "dense", KR: "dense", IN: "dense", ID: "tropical",
  AE: "arid", SA: "arid", AU: "suburban", NZ: "suburban",
};

/** Famous cities force a specific layout + palette. */
const CITY_LAYOUT_OVERRIDE: Record<string, LayoutKind> = {
  lagos: "tropical", abuja: "suburban",
  nyc: "dense", newyork: "dense", la: "suburban", "los-angeles": "suburban",
  london: "classic", paris: "classic", berlin: "classic",
  tokyo: "dense", osaka: "dense", dubai: "arid", "abu-dhabi": "arid",
  mumbai: "dense", delhi: "dense", "sao-paulo": "dense", saopaulo: "dense",
  sydney: "coastal", melbourne: "suburban", capetown: "coastal",
};

const LAYOUTS: Record<LayoutKind, LayoutProfile> = {
  dense: {
    kind: "dense",
    blocks: [
      [-24, -24], [-12, -24], [0, -24], [12, -24], [24, -24],
      [-24, -12], [24, -12], [-24, 0], [24, 0], [-24, 12], [24, 12],
      [-24, 24], [-12, 24], [0, 24], [12, 24], [24, 24],
      [-36, -12], [-36, 12], [36, -12], [36, 12],
      [-12, -36], [12, -36], [-12, 36], [12, 36],
      [-36, -36], [36, -36], [-36, 36],
    ],
    streets: [-36, -24, -12, 12, 24, 36],
    minFloors: 8, maxFloors: 28, widthMin: 6, widthSpan: 5, depthMin: 6, depthSpan: 4,
    parkRadius: 10, treeCount: 8,
  },
  suburban: {
    kind: "suburban",
    blocks: [
      [-30, -30], [-15, -30], [0, -30], [15, -30], [30, -30],
      [-30, -15], [30, -15], [-30, 15], [30, 15],
      [-30, 30], [-15, 30], [0, 30], [15, 30], [30, 30],
      [-45, 0], [45, -15], [-15, -45], [15, 45],
    ],
    streets: [-45, -30, -15, 15, 30, 45],
    minFloors: 3, maxFloors: 12, widthMin: 7, widthSpan: 5, depthMin: 7, depthSpan: 4,
    parkRadius: 16, treeCount: 28,
  },
  coastal: {
    kind: "coastal",
    blocks: [
      [-28, -14], [-14, -14], [0, -14], [14, -14], [28, -14],
      [-28, 0], [28, 0], [-28, 14], [-14, 14], [0, 14], [14, 14], [28, 14],
      [-28, 28], [-14, 28], [0, 28], [14, 28],
      [-42, 0], [-42, 14], [42, 14],
    ],
    streets: [-42, -28, -14, 14, 28, 42],
    minFloors: 6, maxFloors: 18, widthMin: 6, widthSpan: 5, depthMin: 6, depthSpan: 4,
    parkRadius: 14, treeCount: 18,
  },
  arid: {
    kind: "arid",
    blocks: [
      [-22, -22], [-8, -22], [8, -22], [22, -22],
      [-22, -8], [22, -8], [-22, 8], [22, 8],
      [-22, 22], [-8, 22], [8, 22], [22, 22],
      [-36, 0], [36, 0], [0, -36], [0, 36],
    ],
    streets: [-36, -22, -8, 8, 22, 36],
    minFloors: 8, maxFloors: 24, widthMin: 7, widthSpan: 6, depthMin: 7, depthSpan: 5,
    parkRadius: 8, treeCount: 4,
  },
  tropical: {
    kind: "tropical",
    blocks: [
      [-26, -26], [-13, -26], [0, -26], [13, -26], [26, -26],
      [-26, -13], [26, -13], [-26, 13], [26, 13],
      [-26, 26], [-13, 26], [0, 26], [13, 26], [26, 26],
      [-39, -13], [-39, 13], [39, -13], [39, 13],
      [-13, -39], [13, -39], [-13, 39], [13, 39],
    ],
    streets: [-39, -26, -13, 13, 26, 39],
    minFloors: 6, maxFloors: 18, widthMin: 6, widthSpan: 5, depthMin: 6, depthSpan: 4,
    parkRadius: 15, treeCount: 24,
  },
  classic: {
    kind: "classic",
    blocks: [
      [-25, -25], [-12, -25], [0, -25], [12, -25], [25, -25],
      [-25, -12], [25, -12], [-25, 0], [25, 0], [-25, 12], [25, 12],
      [-25, 25], [-12, 25], [0, 25], [12, 25], [25, 25],
      [-38, -12], [38, 12], [-12, -38], [12, 38],
    ],
    streets: [-38, -25, -12, 12, 25, 38],
    minFloors: 7, maxFloors: 20, widthMin: 6, widthSpan: 4, depthMin: 6, depthSpan: 4,
    parkRadius: 12, treeCount: 16,
  },
};

const VARIANT_THEME: Record<LayoutKind, CityTheme> = {
  dense: { ground: "#3a3a42", road: "#1f1f24", grass: "#2a5a35", skyHint: "#7aa0c0", styles: ["glass", "modern", "modern"] },
  suburban: { ground: "#4a4538", road: "#2c2c30", grass: "#3a6a3a", skyHint: "#8ec8f0", styles: ["modern", "shop", "classic"] },
  coastal: { ground: "#3e4a48", road: "#2a3034", grass: "#2f6b50", skyHint: "#7ec8e8", styles: ["modern", "shop", "glass"] },
  arid: { ground: "#5a5040", road: "#2a2a2e", grass: "#4a5a38", skyHint: "#70b8e8", styles: ["glass", "modern", "glass"] },
  tropical: { ground: "#3d4a3a", road: "#2a2a2e", grass: "#2f6b3a", skyHint: "#87b8d8", styles: ["shop", "modern", "brick"] },
  classic: { ground: "#3e4248", road: "#252528", grass: "#2d5a38", skyHint: "#9aabbc", styles: ["classic", "brick", "modern"] },
};

/** Optional per-city palette override (on top of layout variant). */
const CITY_THEME_OVERRIDE: Record<string, Partial<CityTheme>> = {
  lagos: { ground: "#3d4a3a", grass: "#2f6b3a", styles: ["shop", "modern", "brick"] },
  tokyo: { styles: ["glass", "modern", "shop"] },
  london: { styles: ["classic", "brick", "modern"] },
  dubai: { ground: "#5a5040", styles: ["glass", "modern", "glass"] },
  paris: { styles: ["classic", "classic", "shop"] },
};

function layoutKindFor(cityKey: string, countryCode?: string): LayoutKind {
  const key = (cityKey || "").toLowerCase().replace(/\s+/g, "-");
  if (CITY_LAYOUT_OVERRIDE[key]) return CITY_LAYOUT_OVERRIDE[key];
  // Georgia-style keys: "georgia-central" → hash into variants if no country match
  const cc = (countryCode || "").toUpperCase();
  if (cc && COUNTRY_LAYOUT[cc]) return COUNTRY_LAYOUT[cc];
  const kinds: LayoutKind[] = ["dense", "suburban", "coastal", "arid", "tropical", "classic"];
  return kinds[hash(key) % kinds.length];
}

function profileFor(cityKey: string, countryCode?: string): { layout: LayoutProfile; theme: CityTheme } {
  const kind = layoutKindFor(cityKey, countryCode);
  const layout = LAYOUTS[kind];
  const base = { ...VARIANT_THEME[kind] };
  const over = CITY_THEME_OVERRIDE[(cityKey || "").toLowerCase()] || {};
  return { layout, theme: { ...base, ...over, styles: over.styles || base.styles } };
}

function Building({
  position,
  width,
  depth,
  floors,
  style,
  seed,
  mobile,
  residential = false,
}: {
  residential?: boolean;
  position: [number, number, number];
  width: number;
  depth: number;
  floors: number;
  style: "modern" | "brick" | "glass" | "classic" | "shop";
  seed: number;
  mobile: boolean;
}) {
  const worldTime = useGameStore((s) => s.worldTime);
  const isNight = worldTime < 6 || worldTime >= 19.5;
  const floorH = style === "shop" ? 3.6 : 3.4;
  const h = floors * floorH;
  const bodyColor =
    style === "brick" ? "#a0524d" :
    style === "glass" ? "#6b8cae" :
    style === "classic" ? "#d4c4a8" :
    style === "shop" ? "#e8d5b7" : "#9aa3ad";

  // On mobile: skip per-window meshes — use emissive strip bands instead
  const bands = useMemo(() => {
    if (!mobile) return [];
    const list: number[] = [];
    for (let f = 1; f < floors; f++) list.push(f * floorH + floorH * 0.4);
    return list;
  }, [floors, floorH, mobile]);

  const windows = useMemo(() => {
    if (mobile) return [];
    const list: { x: number; y: number; z: number; w: number; h: number; side: number }[] = [];
    const winW = style === "glass" ? 1.2 : 0.75;
    const winH = style === "glass" ? floorH * 0.7 : 1.1;
    for (let f = 0; f < floors; f++) {
      const y = f * floorH + floorH * 0.55;
      const cols = Math.max(1, Math.floor(width / 2.2));
      for (let c = 0; c < cols; c++) {
        const x = cols === 1 ? 0 : -width / 2 + 1.0 + (c * (width - 2)) / Math.max(1, cols - 1);
        list.push({ x, y, z: depth / 2 + 0.02, w: winW, h: winH, side: 0 });
      }
    }
    return list;
  }, [width, depth, floors, floorH, style, mobile]);

  // Choose the kit building (houses, shops, offices, skyscrapers, plus your store/apartment) that best fits this lot.
  const kit = useMemo(
    () => pickBuilding(poolFor(residential ? "residential" : "commercial", floors), width, h, depth, seed),
    [residential, floors, width, h, depth, seed],
  );

  // The original procedural building. It is also the fallback while a model loads.
  const procedural = (
    <>
      <mesh castShadow={!mobile} receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[width, h, depth]} />
        <meshStandardMaterial
          color={bodyColor}
          roughness={style === "glass" ? 0.2 : 0.85}
          metalness={style === "glass" ? 0.35 : 0.05}
        />
      </mesh>
      {/* Roof */}
      <mesh position={[0, h + 0.15, 0]}>
        <boxGeometry args={[width + 0.3, 0.3, depth + 0.3]} />
        <meshStandardMaterial color="#3a3a40" roughness={0.9} />
      </mesh>
      {/* Mobile light bands */}
      {bands.map((y, i) =>
        rand(seed + i) > 0.4 ? (
          <mesh key={i} position={[0, y, depth / 2 + 0.03]}>
            <planeGeometry args={[width * 0.75, 0.35]} />
            <meshStandardMaterial color={isNight ? "#ffe9a0" : "#a9c2d2"} emissive="#ffcc66" emissiveIntensity={isNight ? 0.95 : 0.04} />
          </mesh>
        ) : null
      )}
      {/* Desktop windows */}
      {windows.map((w, i) =>
        rand(seed + i) > 0.3 ? (
          <mesh key={i} position={[w.x, w.y, w.z]}>
            <planeGeometry args={[w.w, w.h]} />
            <meshStandardMaterial color={isNight ? "#ffe9b3" : "#c8e0f0"} emissive="#ffcc77" emissiveIntensity={isNight ? 1.0 : 0.03} />
          </mesh>
        ) : null
      )}
    </>
  );

  return (
    <group position={position}>
      <ModelOrFallback
        url={kit.url}
        fit={{ width, height: h, depth, mode: "stretch" }}
        yaw={kit.yaw}
        shadows={!mobile}
        fallback={procedural}
      />
    </group>
  );
}

export function City() {
  const cityKey = useGameStore((s) => s.character?.cityKey) || "lagos";
  const countryCode = useGameStore((s) => s.character?.countryCode) || "";
  const worldTime = useGameStore((s) => s.worldTime);
  const mobile = useMemo(() => isMobile(), []);
  const isNight = worldTime < 6 || worldTime >= 19.5;
  const seed = hash(cityKey + "|" + countryCode);
  const { layout, theme } = useMemo(() => profileFor(cityKey, countryCode), [cityKey, countryCode]);

  // Layout variant drives block grid, height, and footprint per country/city.
  const buildings = useMemo(() => {
    const list: {
      position: [number, number, number];
      width: number;
      depth: number;
      floors: number;
      style: BuildStyle;
      seed: number;
      residential: boolean;
    }[] = [];

    /**
     * Proper city grid: roads on a fixed spacing, buildings only in block centres.
     * GRID = distance between parallel roads. ROAD_HALF = half the driveable width.
     * This stops random boxes sitting on asphalt and makes Kenney road tiles line up.
     */
    const GRID = 14;
    const ROAD_HALF = 5.0;
    const extent = mobile ? 2 : 3; // how many rings of blocks around centre
    const floorSpan = Math.max(1, layout.maxFloors - layout.minFloors);
    let idx = 0;

    for (let gx = -extent; gx <= extent; gx++) {
      for (let gz = -extent; gz <= extent; gz++) {
        // Skip the central park ring
        if (Math.abs(gx) + Math.abs(gz) === 0) continue;
        // Keep eastern edge free for player homes
        if (gx >= 3) continue;

        // Block centre sits between road lines at gx*GRID and (gx±1)*GRID
        const x = gx * GRID + (gx >= 0 ? GRID / 2 : -GRID / 2);
        const z = gz * GRID + (gz >= 0 ? GRID / 2 : -GRID / 2);
        // Extra clearance from the main cross (x=0 / z=0 avenues)
        if (Math.abs(x) < ROAD_HALF + 3 || Math.abs(z) < ROAD_HALF + 3) continue;

        const r = rand(seed + idx * 17);
        const floors = layout.minFloors + Math.floor(r * (mobile ? Math.min(floorSpan, 12) : floorSpan));
        // Lot size stays inside the block (leave sidewalk margin)
        const maxLot = GRID - ROAD_HALF * 2 - 1.5;
        const width = Math.min(maxLot, layout.widthMin + rand(seed + idx * 3) * layout.widthSpan);
        const depth = Math.min(maxLot, layout.depthMin + rand(seed + idx * 5) * layout.depthSpan);
        const style = theme.styles[Math.floor(rand(seed + idx * 9) * theme.styles.length)] as BuildStyle;
        const residential =
          style !== "shop" &&
          style !== "glass" &&
          layout.kind !== "dense" &&
          layout.kind !== "arid";

        list.push({
          position: [x, 0, z],
          width,
          depth,
          floors,
          style,
          seed: seed + idx,
          residential,
        });
        idx += 1;
        if (mobile && idx >= 16) break;
      }
      if (mobile && idx >= 16) break;
    }
    return list;
  }, [seed, theme, mobile, layout]);

  // Landmark footprints from shared BUILDINGS (hospital, school, etc.)
  const landmarks = useMemo(() => {
    return Object.entries(BUILDINGS)
      .filter(([, b]) => b.radius > 0)
      .map(([key, b]) => {
        const style = LANDMARK_STYLE[key] || LANDMARK_STYLE.shop;
        return {
          key,
          name: b.name,
          x: b.x,
          z: b.z,
          w: style.w,
          d: style.d,
          floors: style.floors,
          color: style.color,
          accent: style.accent,
        };
      });
  }, []);

  // Feed procedural + landmark footprints to the movement system so
  // visible buildings are solid instead of characters walking through them.
  useEffect(() => {
    const procedural = buildings.map((building) => ({
      x: building.position[0],
      z: building.position[2],
      halfWidth: building.width / 2,
      halfDepth: building.depth / 2,
    }));
    const landmarkBoxes = landmarks.map((l) => ({
      x: l.x,
      z: l.z,
      halfWidth: l.w / 2,
      halfDepth: l.d / 2,
    }));
    setCityBoxColliders([...procedural, ...landmarkBoxes]);
    return () => setCityBoxColliders([]);
  }, [buildings, landmarks]);

  const trees = useMemo(() => {
    const n = mobile ? Math.min(10, layout.treeCount) : layout.treeCount;
    const list: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = rand(seed + 100 + i) * Math.PI * 2;
      const d = 3 + rand(seed + 200 + i) * layout.parkRadius;
      list.push([Math.cos(a) * d, Math.sin(a) * d]);
    }
    for (let i = 0; i < (mobile ? 4 : 10); i++) {
      list.push([-40 + i * 7, -10 + (i % 3) * 9]);
    }
    return list;
  }, [seed, mobile, layout]);

  const worldSize = 700; // wide enough for several hundred persistent player homes
  const neighbourhoodRoads = Array.from({ length: 24 }, (_, i) => 35 + i * 12);
  // Fixed road grid matching building block centres (GRID=14 in buildings generator).
  const localStreets = [-42, -28, -14, 14, 28, 42];

  const oldAvenue = (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[10, worldSize]} />
        <meshStandardMaterial color={theme.road} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[worldSize, 10]} />
        <meshStandardMaterial color={theme.road} roughness={0.9} />
      </mesh>
      {/* Broken centre markings make the two main avenues read as drivable roads. */}
      {Array.from({ length: 69 }, (_, i) => -336 + i * 10).map((z) => (
        <mesh key={`vertical-road-mark-${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.024, z]}>
          <planeGeometry args={[0.13, 3.2]} />
          <meshStandardMaterial color="#e4d7a0" roughness={0.82} />
        </mesh>
      ))}
      {Array.from({ length: 69 }, (_, i) => -336 + i * 10).map((x) => (
        <mesh key={`horizontal-road-mark-${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.024, 0]}>
          <planeGeometry args={[3.2, 0.13]} />
          <meshStandardMaterial color="#e4d7a0" roughness={0.82} />
        </mesh>
      ))}
    </>
  );

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[worldSize, worldSize]} />
        <meshStandardMaterial color={theme.ground} roughness={0.95} />
      </mesh>

      {/* Main avenues: Kenney road tiles, falling back to the original flat asphalt + markings. */}
      <InstancedTiles url={MODELS.roadStraight} tiles={AVENUE_TILES} size={AVENUE_TILE} fallback={oldAvenue} />
      <ModelOrFallback
        url={MODELS.roadCrossroad}
        fit={{ width: AVENUE_TILE, depth: AVENUE_TILE, mode: "stretch" }}
        shadows={false}
        fallback={
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.021, 0]} receiveShadow>
            <planeGeometry args={[AVENUE_TILE, AVENUE_TILE]} />
            <meshStandardMaterial color={theme.road} roughness={0.9} />
          </mesh>
        }
      />

      {/* Local streets from the layout variant (country/city profile). */}
      {localStreets.map((roadX) => (
        <group key={`local-street-x-${roadX}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roadX, 0.012, 0]} receiveShadow>
            <planeGeometry args={[4.4, 100]} />
            <meshStandardMaterial color={theme.road} roughness={0.92} />
          </mesh>
          {[-1, 1].map((side) => <mesh key={side} rotation={[-Math.PI / 2, 0, 0]} position={[roadX + side * 2.6, 0.023, 0]}>
            <planeGeometry args={[0.9, 100]} />
            <meshStandardMaterial color="#a5a39c" roughness={0.95} />
          </mesh>)}
        </group>
      ))}
      {localStreets.map((roadZ) => (
        <group key={`local-street-z-${roadZ}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, roadZ]} receiveShadow>
            <planeGeometry args={[100, 4.4]} />
            <meshStandardMaterial color={theme.road} roughness={0.92} />
          </mesh>
          {[-1, 1].map((side) => <mesh key={side} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.023, roadZ + side * 2.6]}>
            <planeGeometry args={[100, 0.9]} />
            <meshStandardMaterial color="#a5a39c" roughness={0.95} />
          </mesh>)}
        </group>
      ))}

      {/* A growing residential district. Homes sit east of these streets and face them. */}
      {neighbourhoodRoads.map((roadX, i) => (
        <group key={`neighbourhood-road-${i}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roadX, 0.015, 0]} receiveShadow>
            <planeGeometry args={[6, worldSize]} />
            <meshStandardMaterial color={theme.road} roughness={0.92} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roadX + 3.55, 0.025, 0]}>
            <planeGeometry args={[1.1, worldSize]} />
            <meshStandardMaterial color="#999a96" roughness={0.96} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roadX - 3.55, 0.025, 0]}>
            <planeGeometry args={[1.1, worldSize]} />
            <meshStandardMaterial color="#999a96" roughness={0.96} />
          </mesh>
          {/* Broken centre line */}
          {Array.from({ length: mobile ? 14 : 22 }, (_, dash) => (
            <mesh key={dash} rotation={[-Math.PI / 2, 0, 0]} position={[roadX, 0.026, -154 + dash * (mobile ? 23.7 : 14.2)]}>
              <planeGeometry args={[0.12, 4.2]} />
              <meshStandardMaterial color="#e2d7a8" roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Central park — size from layout variant */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[layout.parkRadius, 32]} />
        <meshStandardMaterial color={theme.grass} roughness={0.95} />
      </mesh>

      {/* Stone walking paths through the central park. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <planeGeometry args={[1.6, layout.parkRadius * 1.75]} />
        <meshStandardMaterial color="#b9b2a2" roughness={0.96} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, Math.PI / 2, 0]} position={[0, 0.036, 0]}>
        <planeGeometry args={[1.6, layout.parkRadius * 1.75]} />
        <meshStandardMaterial color="#b9b2a2" roughness={0.96} />
      </mesh>

      {/* Coastal cities get a water strip on the south edge */}
      {layout.kind === "coastal" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -55]} receiveShadow>
          <planeGeometry args={[120, 28]} />
          <meshStandardMaterial color="#2a6a8a" roughness={0.35} metalness={0.15} transparent opacity={0.92} />
        </mesh>
      )}
      {/* Arid cities: lighter sand patches near park edge */}
      {layout.kind === "arid" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[22, 0.015, -22]}>
          <circleGeometry args={[10, 16]} />
          <meshStandardMaterial color="#c4a574" roughness={0.98} />
        </mesh>
      )}

      {/* Benches, planters and waste bins make the park usable, not just decorative. */}
      {[-1, 1].map((side) => (
        <group key={`park-furniture-${side}`}>
          {[-1, 1].map((end) => (
            <group key={`${side}-${end}`} position={[side * 6.5, 0, end * 5]} rotation={[0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}>
              <mesh position={[0, 0.62, 0]} castShadow={!mobile}>
                <boxGeometry args={[2.1, 0.14, 0.62]} />
                <meshStandardMaterial color="#8e6545" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.82, -0.22]}>
                <boxGeometry args={[2.1, 0.42, 0.12]} />
                <meshStandardMaterial color="#8e6545" roughness={0.9} />
              </mesh>
              {[-0.78, 0.78].map((leg) => (
                <mesh key={leg} position={[leg, 0.3, 0]}>
                  <boxGeometry args={[0.12, 0.6, 0.12]} />
                  <meshStandardMaterial color="#414446" metalness={0.35} roughness={0.65} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={`park-bin-${side}`} position={[side * 11.2, 0, 0]}>
          <mesh position={[0, 0.48, 0]} castShadow={!mobile}>
            <cylinderGeometry args={[0.28, 0.34, 0.9, 8]} />
            <meshStandardMaterial color="#42585a" roughness={0.76} />
          </mesh>
          <mesh position={[0, 0.96, 0]}>
            <cylinderGeometry args={[0.31, 0.31, 0.1, 8]} />
            <meshStandardMaterial color="#27383a" roughness={0.72} />
          </mesh>
        </group>
      ))}

      {buildings.map((b, i) => (
        <Building key={i} {...b} mobile={mobile} />
      ))}

      {/* Main avenue sidewalks */}
      {[-1, 1].map((side) => (
        <group key={`sidewalk-${side}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[side * 6.2, 0.018, 0]} receiveShadow>
            <planeGeometry args={[2.2, worldSize]} />
            <meshStandardMaterial color="#9a9890" roughness={0.96} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, side * 6.2]} receiveShadow>
            <planeGeometry args={[worldSize, 2.2]} />
            <meshStandardMaterial color="#9a9890" roughness={0.96} />
          </mesh>
        </group>
      ))}

      {/* Crosswalks at the main intersection */}
      {[-3, -1.5, 0, 1.5, 3].map((offset, i) => (
        <group key={`crosswalk-${i}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[offset, 0.028, 0]}>
            <planeGeometry args={[0.55, 8]} />
            <meshStandardMaterial color="#ececec" roughness={0.85} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.029, offset]}>
            <planeGeometry args={[8, 0.55]} />
            <meshStandardMaterial color="#ececec" roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* Named landmarks — clearer massing, entrance, sign pole */}
      {landmarks.map((l) => {
        const h = l.floors * 3.1;
        return (
          <group key={`landmark-${l.key}`} position={[l.x, 0, l.z]}>
            {/* Landmark body: shop and apartments use your GLB models, everything else the original massing. */}
            {(() => {
              const landmarkKit = l.key === "shop" ? USER_STORE : l.key === "apartments" ? USER_APARTMENT : pickBuilding(COMMERCIAL, l.w, h, l.d, hash(l.key));
              const facade = (
                <>
            <mesh castShadow={!mobile} receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[l.w, h, l.d]} />
              <meshStandardMaterial color={l.color} roughness={0.68} metalness={l.key === "university" ? 0.2 : 0.06} />
            </mesh>
            {/* Entrance canopy */}
            <mesh position={[0, 2.4, l.d / 2 + 0.6]}>
              <boxGeometry args={[Math.min(l.w * 0.55, 5), 0.18, 1.4]} />
              <meshStandardMaterial color={l.accent} roughness={0.5} />
            </mesh>
            {/* Door */}
            <mesh position={[0, 1.2, l.d / 2 + 0.05]}>
              <boxGeometry args={[1.4, 2.3, 0.12]} />
              <meshStandardMaterial color="#2a2e34" roughness={0.55} metalness={0.15} />
            </mesh>
            {/* Sign band */}
            <mesh position={[0, h * 0.72, l.d / 2 + 0.06]}>
              <boxGeometry args={[l.w * 0.75, 0.7, 0.1]} />
              <meshStandardMaterial color={l.accent} emissive={l.accent} emissiveIntensity={isNight ? 0.55 : 0.08} />
            </mesh>
                </>
              );
              return (
                <>
                  <ModelOrFallback
                    url={landmarkKit.url}
                    fit={{ width: l.w, height: h, depth: l.d, mode: "stretch" }}
                    yaw={landmarkKit.yaw}
                    shadows={!mobile}
                    fallback={facade}
                  />
                  {/* Coloured name board over the entrance so each landmark type stays recognisable. */}
                  <mesh position={[0, 3.6, l.d / 2 + 0.1]}>
                    <boxGeometry args={[Math.min(l.w * 0.5, 4.5), 0.7, 0.14]} />
                    <meshStandardMaterial color={l.accent} emissive={l.accent} emissiveIntensity={isNight ? 0.55 : 0.1} />
                  </mesh>
                </>
              );
            })()}
            {/* Ground plaza pad */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, l.d / 2 + 1.2]}>
              <planeGeometry args={[l.w + 2, 3.2]} />
              <meshStandardMaterial color="#8a8680" roughness={0.94} />
            </mesh>
            {/* Sign pole at street edge */}
            <mesh position={[l.w * 0.45, 1.6, l.d / 2 + 2.4]}>
              <cylinderGeometry args={[0.06, 0.07, 3.2, 6]} />
              <meshStandardMaterial color="#3a3a3e" />
            </mesh>
            <mesh position={[l.w * 0.45, 3.35, l.d / 2 + 2.4]}>
              <boxGeometry args={[1.8, 0.7, 0.12]} />
              <meshStandardMaterial color={l.accent} emissive={l.accent} emissiveIntensity={isNight ? 0.7 : 0.1} />
            </mesh>
            {/* Hospital cross */}
            {l.key === "hospital" && (
              <group position={[0, h + 1.1, 0]}>
                <mesh>
                  <boxGeometry args={[0.45, 2.2, 0.35]} />
                  <meshStandardMaterial color="#d64545" emissive="#d64545" emissiveIntensity={isNight ? 0.8 : 0.15} />
                </mesh>
                <mesh>
                  <boxGeometry args={[1.6, 0.45, 0.35]} />
                  <meshStandardMaterial color="#d64545" emissive="#d64545" emissiveIntensity={isNight ? 0.8 : 0.15} />
                </mesh>
              </group>
            )}
            {l.key !== "hospital" && (
              <mesh position={[0, h + 0.4, 0]}>
                <boxGeometry args={[l.w * 0.22, 0.55, 0.35]} />
                <meshStandardMaterial color={l.accent} emissive={l.accent} emissiveIntensity={isNight ? 0.4 : 0.06} />
              </mesh>
            )}
            {isNight && (
              <pointLight position={[0, h * 0.55, l.d / 2 + 1.2]} intensity={mobile ? 0.4 : 0.7} distance={16} color="#ffd9a0" />
            )}
          </group>
        );
      })}

      {/* Layout-specific props so tropical / dense / arid / classic read differently */}
      {layout.kind === "tropical" &&
        [[-10, 8], [12, -6], [-8, -12], [9, 11]].map(([px, pz], i) => (
          <group key={`market-${i}`} position={[px, 0, pz]}>
            <mesh position={[0, 1.1, 0]}>
              <boxGeometry args={[3.2, 0.12, 2.2]} />
              <meshStandardMaterial color={i % 2 ? "#d94b3a" : "#e8b84a"} />
            </mesh>
            <mesh position={[-1.3, 0.55, -0.9]}>
              <cylinderGeometry args={[0.07, 0.07, 1.1, 5]} />
              <meshStandardMaterial color="#5c4030" />
            </mesh>
            <mesh position={[1.3, 0.55, -0.9]}>
              <cylinderGeometry args={[0.07, 0.07, 1.1, 5]} />
              <meshStandardMaterial color="#5c4030" />
            </mesh>
            <mesh position={[-1.3, 0.55, 0.9]}>
              <cylinderGeometry args={[0.07, 0.07, 1.1, 5]} />
              <meshStandardMaterial color="#5c4030" />
            </mesh>
            <mesh position={[1.3, 0.55, 0.9]}>
              <cylinderGeometry args={[0.07, 0.07, 1.1, 5]} />
              <meshStandardMaterial color="#5c4030" />
            </mesh>
            <mesh position={[0, 0.45, 0]}>
              <boxGeometry args={[2.6, 0.7, 1.4]} />
              <meshStandardMaterial color="#6b5344" />
            </mesh>
          </group>
        ))}
      {layout.kind === "dense" &&
        [[-16, -10], [14, 8], [-12, 14], [18, -14]].map(([px, pz], i) => (
          <group key={`neon-${i}`} position={[px, 0, pz]}>
            <mesh position={[0, 5.5, 0]}>
              <boxGeometry args={[0.2, 8, 0.2]} />
              <meshStandardMaterial color="#2a2a30" />
            </mesh>
            <mesh position={[0.25, 7.2, 0]}>
              <boxGeometry args={[1.6, 0.9, 0.15]} />
              <meshStandardMaterial
                color={["#ff4d6d", "#4cc9f0", "#b5179e", "#80ed99"][i % 4]}
                emissive={["#ff4d6d", "#4cc9f0", "#b5179e", "#80ed99"][i % 4]}
                emissiveIntensity={isNight ? 1.2 : 0.15}
              />
            </mesh>
          </group>
        ))}
      {layout.kind === "classic" &&
        [[-14, 10], [11, -9], [-9, -14], [13, 12]].map(([px, pz], i) => (
          <group key={`classic-prop-${i}`} position={[px, 0, pz]}>
            <mesh position={[0, 0.9, 0]}>
              <cylinderGeometry args={[0.55, 0.65, 1.8, 8]} />
              <meshStandardMaterial color="#cfc6b4" roughness={0.85} />
            </mesh>
            <mesh position={[0, 2.0, 0]}>
              <sphereGeometry args={[0.35, 8, 8]} />
              <meshStandardMaterial color="#b8aea0" />
            </mesh>
          </group>
        ))}
      {layout.kind === "arid" &&
        [[-18, 6], [16, -8], [8, 16]].map(([px, pz], i) => (
          <mesh key={`sand-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[px, 0.02, pz]}>
            <circleGeometry args={[4 + i, 12]} />
            <meshStandardMaterial color="#c4a574" roughness={0.98} />
          </mesh>
        ))}

      {trees.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <CityTree kind={layout.kind} mobile={mobile} index={i} />
        </group>
      ))}
      <ParkDecor radius={layout.parkRadius} seed={seed} mobile={mobile} />

      {/* Street lamps — real point lights at night on all devices (weaker on mobile). */}
      {(mobile ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 5, 6, 7]).map((i) => {
        const a = (i / 8) * Math.PI * 2;
        const d = 18;
        return (
          <group key={i} position={[Math.cos(a) * d, 0, Math.sin(a) * d]}>
            <mesh position={[0, 2, 0]}>
              <cylinderGeometry args={[0.08, 0.1, 4, 6]} />
              <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[0, 4.1, 0]}>
              <sphereGeometry args={[0.25, 8, 8]} />
              <meshStandardMaterial color={isNight ? "#ffe9a0" : "#6f736f"} emissive="#ffaa44" emissiveIntensity={isNight ? 2.4 : 0.02} />
            </mesh>
            {isNight && (
              <pointLight position={[0, 4, 0]} intensity={mobile ? 0.75 : 1.25} distance={mobile ? 14 : 20} color="#ffcc88" />
            )}
          </group>
        );
      })}
      {/* Neighbourhood street lamps use emissive bulbs on all devices. */}
      {neighbourhoodRoads.map((roadX, row) =>
        (mobile ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 5, 6]).map((i) => {
          const z = -42 + i * 14;
          return (
            <group key={`home-lamp-${row}-${i}`} position={[roadX + 2.8, 0, z]}>
              <mesh position={[0, 2.1, 0]}>
                <cylinderGeometry args={[0.055, 0.075, 4.2, 6]} />
                <meshStandardMaterial color="#363a3b" />
              </mesh>
              <mesh position={[0, 4.25, 0]}>
                <sphereGeometry args={[0.2, 7, 7]} />
                <meshStandardMaterial color={isNight ? "#ffe9a0" : "#747974"} emissive="#ffbd69" emissiveIntensity={isNight ? 1.4 : 0.015} />
              </mesh>
            </group>
          );
        })
      )}
    </group>
  );
}

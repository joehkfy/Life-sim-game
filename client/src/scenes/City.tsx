import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGameStore } from "../stores/gameStore";
import { setCityBoxColliders } from "./collisionWorld";

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

/** Visual theme per city — same layout system, different look */
const CITY_THEMES: Record<string, { ground: string; road: string; grass: string; skyHint: string; styles: ("modern" | "brick" | "glass" | "classic" | "shop")[] }> = {
  lagos: { ground: "#3d4a3a", road: "#2a2a2e", grass: "#2f6b3a", skyHint: "#87b8d8", styles: ["shop", "modern", "brick"] },
  abuja: { ground: "#4a4a40", road: "#333338", grass: "#3a6b45", skyHint: "#9ec5e0", styles: ["modern", "classic", "shop"] },
  newyork: { ground: "#3a3a42", road: "#1f1f24", grass: "#2a5a35", skyHint: "#7aa0c0", styles: ["glass", "modern", "modern"] },
  la: { ground: "#4a4538", road: "#2c2c30", grass: "#3a6a3a", skyHint: "#8ec8f0", styles: ["modern", "shop", "classic"] },
  london: { ground: "#3e4248", road: "#252528", grass: "#2d5a38", skyHint: "#9aabbc", styles: ["classic", "brick", "modern"] },
  tokyo: { ground: "#3a3e48", road: "#1a1a22", grass: "#2a5840", skyHint: "#6a90b8", styles: ["glass", "modern", "shop"] },
  dubai: { ground: "#5a5040", road: "#2a2a2e", grass: "#3a6a48", skyHint: "#70b8e8", styles: ["glass", "modern", "glass"] },
  paris: { ground: "#4a4640", road: "#2a2828", grass: "#356a40", skyHint: "#a8c0d8", styles: ["classic", "classic", "shop"] },
  default: { ground: "#3a4540", road: "#28282c", grass: "#2f6340", skyHint: "#88b4d4", styles: ["modern", "shop", "brick"] },
};

function themeFor(cityKey: string) {
  return CITY_THEMES[cityKey] || CITY_THEMES.default;
}

function Building({
  position,
  width,
  depth,
  floors,
  style,
  seed,
  mobile,
}: {
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
  const floorH = style === "shop" ? 3.2 : 3.0;
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

  return (
    <group position={position}>
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
    </group>
  );
}

export function City() {
  const cityKey = useGameStore((s) => s.character?.cityKey) || "lagos";
  const worldTime = useGameStore((s) => s.worldTime);
  const mobile = useMemo(() => isMobile(), []);
  const isNight = worldTime < 6 || worldTime >= 19.5;
  const theme = themeFor(cityKey);
  const seed = hash(cityKey);

  // Layout: larger world bounds, but building COUNT capped on mobile
  const buildings = useMemo(() => {
    const list: {
      position: [number, number, number];
      width: number;
      depth: number;
      floors: number;
      style: "modern" | "brick" | "glass" | "classic" | "shop";
      seed: number;
    }[] = [];

    // Grid of blocks around park — expands playable feel
    const blocks: [number, number][] = [
      [-28, -28], [-14, -28], [0, -28], [14, -28], [28, -28],
      [-28, -14], [28, -14],
      [-28, 0], [28, 0],
      [-28, 14], [28, 14],
      [-28, 28], [-14, 28], [0, 28], [14, 28], [28, 28],
      [-42, -14], [-42, 14], [42, -14], [42, 14],
      [-14, -42], [14, -42], [-14, 42], [14, 42],
    ];

    const max = mobile ? 16 : blocks.length;
    for (let i = 0; i < max; i++) {
      const [bx, bz] = blocks[i];
      // Keep the eastern edge clear for the persistent player-owned home district.
      if (bx >= 28) continue;
      const r = rand(seed + i * 17);
      const floors = 2 + Math.floor(r * (mobile ? 4 : 7));
      const width = 6 + rand(seed + i * 3) * 6;
      const depth = 6 + rand(seed + i * 5) * 5;
      const style = theme.styles[Math.floor(rand(seed + i * 9) * theme.styles.length)];
      list.push({
        position: [bx + (rand(seed + i) - 0.5) * 4, 0, bz + (rand(seed + i * 2) - 0.5) * 4],
        width,
        depth,
        floors,
        style,
        seed: seed + i,
      });
    }
    return list;
  }, [seed, theme, mobile]);

  // Feed the same generated building footprints to the movement system so
  // visible buildings are solid instead of characters walking through them.
  useEffect(() => {
    setCityBoxColliders(buildings.map((building) => ({
      x: building.position[0],
      z: building.position[2],
      halfWidth: building.width / 2,
      halfDepth: building.depth / 2,
    })));
    return () => setCityBoxColliders([]);
  }, [buildings]);

  const trees = useMemo(() => {
    const n = mobile ? 10 : 22;
    const list: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = rand(seed + 100 + i) * Math.PI * 2;
      const d = 4 + rand(seed + 200 + i) * 14;
      list.push([Math.cos(a) * d, Math.sin(a) * d]);
    }
    // Outer ring
    for (let i = 0; i < (mobile ? 6 : 12); i++) {
      list.push([-35 + i * 6, -8 + (i % 3) * 8]);
    }
    return list;
  }, [seed, mobile]);

  const worldSize = 700; // wide enough for several hundred persistent player homes
  const neighbourhoodRoads = Array.from({ length: 24 }, (_, i) => 35 + i * 12);

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[worldSize, worldSize]} />
        <meshStandardMaterial color={theme.ground} roughness={0.95} />
      </mesh>

      {/* Main roads */}
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
      {/* Connected local streets and pavements make the central blocks walkable. */}
      {[-35, -21, -7, 7, 21].map((roadX) => (
        <group key={`local-street-x-${roadX}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roadX, 0.012, 0]} receiveShadow>
            <planeGeometry args={[3.0, 92]} />
            <meshStandardMaterial color={theme.road} roughness={0.92} />
          </mesh>
          {[-1, 1].map((side) => <mesh key={side} rotation={[-Math.PI / 2, 0, 0]} position={[roadX + side * 2.0, 0.023, 0]}>
            <planeGeometry args={[0.78, 92]} />
            <meshStandardMaterial color="#a5a39c" roughness={0.95} />
          </mesh>)}
        </group>
      ))}
      {[-35, -21, -7, 7, 21, 35].map((roadZ) => (
        <group key={`local-street-z-${roadZ}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, roadZ]} receiveShadow>
            <planeGeometry args={[84, 3.0]} />
            <meshStandardMaterial color={theme.road} roughness={0.92} />
          </mesh>
          {[-1, 1].map((side) => <mesh key={side} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.023, roadZ + side * 2.0]}>
            <planeGeometry args={[84, 0.78]} />
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

      {/* Central park */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[16, 32]} />
        <meshStandardMaterial color={theme.grass} roughness={0.95} />
      </mesh>

      {/* Stone walking paths through the central park. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <planeGeometry args={[1.6, 28]} />
        <meshStandardMaterial color="#b9b2a2" roughness={0.96} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, Math.PI / 2, 0]} position={[0, 0.036, 0]}>
        <planeGeometry args={[1.6, 28]} />
        <meshStandardMaterial color="#b9b2a2" roughness={0.96} />
      </mesh>

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

      {/* Crosswalks */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[s * 8, 0.03, 0]}>
            <planeGeometry args={[1.2, 8]} />
            <meshStandardMaterial color="#e8e8e8" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, s * 8]}>
            <planeGeometry args={[8, 1.2]} />
            <meshStandardMaterial color="#e8e8e8" />
          </mesh>
        </group>
      ))}

      {buildings.map((b, i) => (
        <Building key={i} {...b} mobile={mobile} />
      ))}

      {trees.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.6, 0]} castShadow={!mobile}>
            <cylinderGeometry args={[0.15, 0.2, 1.2, 6]} />
            <meshStandardMaterial color="#5c4030" />
          </mesh>
          <mesh position={[0, 1.6, 0]} castShadow={!mobile}>
            <sphereGeometry args={[0.9, mobile ? 6 : 10, mobile ? 6 : 10]} />
            <meshStandardMaterial color="#2d6b3a" />
          </mesh>
        </group>
      ))}

      {/* Street lamps — few on mobile */}
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
              <meshStandardMaterial color={isNight ? "#ffe9a0" : "#6f736f"} emissive="#ffaa44" emissiveIntensity={isNight ? 1.7 : 0.02} />
            </mesh>
            {!mobile && isNight && (
              <pointLight position={[0, 4, 0]} intensity={0.9} distance={16} color="#ffcc88" />
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

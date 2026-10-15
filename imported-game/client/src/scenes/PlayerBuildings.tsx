import { useEffect, useState, useMemo, useRef } from "react";
import { Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../stores/gameStore";
import { setHomeColliders } from "./collisionWorld";

const API = import.meta.env.VITE_SERVER_URL || "";

const STYLES: Record<string, { color: string; floors: number; style: string }> = {
  house: { color: "#d4a574", floors: 2, style: "house" },
  shop: { color: "#7e6bb8", floors: 2, style: "shop" },
  cafe: { color: "#d4826a", floors: 2, style: "shop" },
  office: { color: "#7a8490", floors: 5, style: "office" },
  studio: { color: "#3d9a94", floors: 2, style: "house" },
  club: { color: "#c45c8a", floors: 3, style: "club" },
  other: { color: "#8b85c4", floors: 2, style: "house" },
};

function PlayerBuildingMesh({
  name,
  buildingType,
  posX,
  posZ,
  rotation = 0,
  isHome = false,
  buildingId,
}: {
  name: string;
  buildingType: string;
  posX: number;
  posZ: number;
  rotation?: number;
  isHome?: boolean;
  buildingId?: string;
}) {
  const worldTime = useGameStore((s) => s.worldTime);
  const isNight = worldTime < 6 || worldTime >= 19.5;
  const cfg = STYLES[buildingType] || STYLES.other;
  const floorH = 2.8;
  const floors = isHome ? 1 : cfg.floors;
  const h = floors * floorH;
  // Homes are wider than commercial-building markers, so their visible exteriors
  // better match the scale of the interior the player enters.
  const w = isHome ? 9 : buildingType === "office" ? 7 : 5.5;
  const d = isHome ? 8 : buildingType === "office" ? 6 : 5.2;
  const detailRef = useRef<THREE.Group>(null);
  const doorRef = useRef<THREE.Group>(null);
  const doorTarget = useRef(0);
  const doorTimer = useRef<number | null>(null);
  const { camera } = useThree();
  const homePosition = useMemo(() => new THREE.Vector3(posX, 0, posZ), [posX, posZ]);
  useEffect(() => {
    if (!isHome || !buildingId) return;
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string }>).detail;
      if (detail?.id !== buildingId) return;
      doorTarget.current = -Math.PI / 2;
      if (doorTimer.current !== null) window.clearTimeout(doorTimer.current);
      doorTimer.current = window.setTimeout(() => {
        doorTarget.current = 0;
        doorTimer.current = null;
      }, 1800);
    };
    window.addEventListener("life-sim:home-door", onOpen);
    return () => {
      window.removeEventListener("life-sim:home-door", onOpen);
      if (doorTimer.current !== null) window.clearTimeout(doorTimer.current);
    };
  }, [isHome, buildingId]);

  useFrame((_, delta) => {
    if (isHome && detailRef.current) {
      detailRef.current.visible = camera.position.distanceToSquared(homePosition) < 75 * 75;
    }
    if (doorRef.current) {
      doorRef.current.rotation.y = THREE.MathUtils.damp(
        doorRef.current.rotation.y,
        doorTarget.current,
        9,
        Math.min(delta, 0.05),
      );
    }
  });

  const windows = useMemo(() => {
    const list: { x: number; y: number; z: number }[] = [];
    for (let f = 0; f < floors; f++) {
      const y = f * floorH + floorH * 0.55;
      for (const x of [-w * 0.28, w * 0.28]) {
        list.push({ x, y, z: d / 2 + 0.03 });
      }
    }
    return list;
  }, [floors, w, d]);

  return (
    <group position={[posX, 0, posZ]} rotation={[0, rotation, 0]}>
      <mesh castShadow={!isHome} receiveShadow={!isHome} position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={cfg.color} roughness={0.75} metalness={0.08} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, h + 0.25, 0]} castShadow={!isHome}>
        <boxGeometry args={[w + 0.35, 0.4, d + 0.35]} />
        <meshStandardMaterial color={isHome ? "#4a3931" : "#3a3a48"} />
      </mesh>
      {isHome && (
        <group position={[0, h + 0.35, 0]}>
          <mesh position={[-2.1, 0.58, 0]} rotation={[0, 0, 0.27]} castShadow>
            <boxGeometry args={[5.2, 0.22, d + 0.55]} />
            <meshStandardMaterial color="#594238" roughness={0.9} />
          </mesh>
          <mesh position={[2.1, 0.58, 0]} rotation={[0, 0, -0.27]} castShadow>
            <boxGeometry args={[5.2, 0.22, d + 0.55]} />
            <meshStandardMaterial color="#594238" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.22, 0]}>
            <boxGeometry args={[0.22, 0.18, d + 0.6]} />
            <meshStandardMaterial color="#3e3029" roughness={0.9} />
          </mesh>
        </group>
      )}
      {/* Fine detail is culled at distance; every owned house still keeps its visible body and roof. */}
      <group ref={detailRef}>
      {/* Windows */}
      {windows.map((win, i) => (
        <group key={i} position={[win.x, win.y, win.z]}>
          <mesh>
            <planeGeometry args={[1.0, 1.15]} />
            <meshStandardMaterial
              color={isNight ? "#ffe9a8" : "#9fc8df"}
              emissive="#ffcc66"
              emissiveIntensity={isNight ? 1.15 : 0.04}
              roughness={0.2}
            />
          </mesh>
          {[-0.56, 0.56].map((offset) => (
            <mesh key={offset} position={[offset, 0, 0.025]}>
              <boxGeometry args={[0.07, 1.28, 0.07]} />
              <meshStandardMaterial color={isHome ? "#f0dfc9" : "#d7d1c8"} roughness={0.8} />
            </mesh>
          ))}
          {[-0.62, 0.62].map((offset) => (
            <mesh key={offset} position={[0, offset, 0.025]}>
              <boxGeometry args={[1.18, 0.07, 0.07]} />
              <meshStandardMaterial color={isHome ? "#f0dfc9" : "#d7d1c8"} roughness={0.8} />
            </mesh>
          ))}
          {isHome && (
            <mesh position={[0, -0.72, 0.08]}>
              <boxGeometry args={[1.35, 0.12, 0.2]} />
              <meshStandardMaterial color="#b9a18a" roughness={0.86} />
            </mesh>
          )}
        </group>
      ))}
      {/* Entrance porch, threshold, door frame and a hinged front door. */}
      {isHome && (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, d / 2 + 2.55]} receiveShadow>
            <planeGeometry args={[4.8, 2.6]} />
            <meshStandardMaterial color="#59724c" roughness={1} />
          </mesh>
          <mesh position={[0, 0.07, d / 2 + 1.7]} receiveShadow>
            <boxGeometry args={[1.15, 0.12, 2.1]} />
            <meshStandardMaterial color="#b7b0a6" roughness={0.95} />
          </mesh>
          <mesh position={[-2.45, 0.28, d / 2 + 1.85]}>
            <cylinderGeometry args={[0.16, 0.2, 0.42, 7]} />
            <meshStandardMaterial color="#b76f54" roughness={0.88} />
          </mesh>
          <mesh position={[-2.45, 0.58, d / 2 + 1.85]}>
            <sphereGeometry args={[0.38, 8, 7]} />
            <meshStandardMaterial color="#427c48" roughness={1} />
          </mesh>
          <mesh position={[2.45, 0.28, d / 2 + 1.85]}>
            <cylinderGeometry args={[0.16, 0.2, 0.42, 7]} />
            <meshStandardMaterial color="#b76f54" roughness={0.88} />
          </mesh>
          <mesh position={[2.45, 0.58, d / 2 + 1.85]}>
            <sphereGeometry args={[0.38, 8, 7]} />
            <meshStandardMaterial color="#427c48" roughness={1} />
          </mesh>
          <mesh position={[0, 0.08, d / 2 + 0.75]} receiveShadow>
            <boxGeometry args={[3.4, 0.16, 1.4]} />
            <meshStandardMaterial color="#b8aaa0" roughness={0.92} />
          </mesh>
          <mesh position={[0, 0.28, d / 2 + 1.25]}>
            <boxGeometry args={[2.6, 0.36, 0.28]} />
            <meshStandardMaterial color="#aa9d91" roughness={0.92} />
          </mesh>
          <mesh position={[-0.72, 1.12, d / 2 + 0.04]}>
            <boxGeometry args={[0.12, 2.3, 0.18]} />
            <meshStandardMaterial color="#f0dfc9" roughness={0.82} />
          </mesh>
          <mesh position={[0.72, 1.12, d / 2 + 0.04]}>
            <boxGeometry args={[0.12, 2.3, 0.18]} />
            <meshStandardMaterial color="#f0dfc9" roughness={0.82} />
          </mesh>
          <mesh position={[0, 2.28, d / 2 + 0.04]}>
            <boxGeometry args={[1.55, 0.12, 0.18]} />
            <meshStandardMaterial color="#f0dfc9" roughness={0.82} />
          </mesh>
          <mesh position={[-1.6, 1.55, d / 2 + 0.14]}>
            <boxGeometry args={[0.24, 0.5, 0.2]} />
            <meshStandardMaterial color="#323a3b" roughness={0.75} />
          </mesh>
          <mesh position={[-1.6, 1.55, d / 2 + 0.24]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#fff0ba" emissive="#ffcc74" emissiveIntensity={isNight ? 1.2 : 0.08} />
          </mesh>
          <pointLight position={[-1.6, 1.7, d / 2 + 0.55]} intensity={isNight ? 0.55 : 0.03} distance={6} color="#ffdc9e" />
        </group>
      )}
      <group ref={doorRef} position={[-0.55, 1.05, d / 2 + 0.055]}>
        <mesh position={[0.55, 0, 0]} castShadow>
          <boxGeometry args={[1.05, 2.1, 0.12]} />
          <meshStandardMaterial color={isHome ? "#67442e" : "#2c1810"} roughness={0.78} />
        </mesh>
        <mesh position={[0.92, 0, 0.08]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial color="#d6b875" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
      {/* Awning for shops */}
      {(buildingType === "shop" || buildingType === "cafe") && (
        <mesh position={[0, 2.6, d / 2 + 0.4]} castShadow>
          <boxGeometry args={[w * 0.9, 0.12, 0.8]} />
          <meshStandardMaterial color="#c0392b" />
        </mesh>
      )}
      <Text
        position={[0, h + 1.4, 0]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#000"
      >
        {name}
      </Text>
      </group>
    </group>
  );
}

export function PlayerBuildings() {
  const token = useGameStore((s) => s.token);
  const character = useGameStore((s) => s.character);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [homes, setHomes] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    const cityKey = (character as any)?.cityKey || "starter";
    let active = true;
    const load = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [buildingResponse, homeResponse] = await Promise.all([
          fetch(`${API}/api/game/world/cities/${cityKey}/buildings`, { headers }),
          fetch(`${API}/api/game/world/cities/${cityKey}/homes`, { headers }),
        ]);
        const [buildingData, homeData] = await Promise.all([
          buildingResponse.json(), homeResponse.json(),
        ]);
        if (!active) return;
        if (Array.isArray(buildingData)) setBuildings(buildingData);
        if (Array.isArray(homeData)) {
          setHomes(homeData);
          setHomeColliders(homeData.map((home: any) => ({
            id: String(home.id),
            x: Number(home.posX),
            z: Number(home.posZ),
            rotation: home.isStarterHome ? -Math.PI / 2 : 0,
            halfWidth: 4.5,
            halfDepth: 4,
          })));
        }
      } catch {
        // The map remains playable if the property feed is temporarily unavailable.
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => { active = false; clearInterval(timer); setHomeColliders([]); };
  }, [token, (character as any)?.cityKey]);

  return (
    <group>
      {buildings.map((b) => (
        <PlayerBuildingMesh
          key={b.id}
          name={b.name}
          buildingType={b.buildingType}
          posX={b.posX}
          posZ={b.posZ}
        />
      ))}
      {homes.map((home) => (
        <PlayerBuildingMesh
          key={`home-${home.id}`}
          name={`${home.ownerName || home.tenantName || home.name}${home.ownerName || home.tenantName ? "'s Home" : ""}`}
          buildingType="house"
          posX={home.posX}
          posZ={home.posZ}
          buildingId={String(home.id)}
          isHome
          // Starter-home plots face the neighbourhood street on their west side.
          rotation={home.isStarterHome ? -Math.PI / 2 : 0}
        />
      ))}
    </group>
  );
}

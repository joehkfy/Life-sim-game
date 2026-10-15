import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../stores/gameStore";
import { HomeFurnitureObject, type HomeFurnitureItem } from "./HomeFurniture";
import { setInteriorFurnitureColliders } from "./collisionWorld";

interface InteriorProps {
  locationKey: string;
}

function WindowFrame({ position, horizontal = true }: { position: [number, number, number]; horizontal?: boolean }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={horizontal ? [2.65, 0.12, 0.16] : [0.12, 1.8, 0.16]} />
        <meshStandardMaterial color="#8b6549" roughness={0.78} />
      </mesh>
    </group>
  );
}

function CeilingLight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.38, 0.5, 0.12, 12]} />
        <meshStandardMaterial color="#ded7c8" roughness={0.72} />
      </mesh>
      <mesh position={[0, -0.085, 0]}>
        <cylinderGeometry args={[0.31, 0.31, 0.045, 12]} />
        <meshStandardMaterial color="#fff1c9" emissive="#ffe4a0" emissiveIntensity={0.48} roughness={0.5} />
      </mesh>
    </group>
  );
}

export function Interior({ locationKey }: InteriorProps) {
  const personalHome = locationKey.startsWith("home_");
  const propertyId = personalHome ? locationKey.slice("home_".length) : "";
  const token = useGameStore((state) => state.token);
  const [furniture, setFurniture] = useState<HomeFurnitureItem[]>([]);

  useEffect(() => {
    if (!personalHome || !propertyId || !token) {
      setFurniture([]);
      return;
    }
    let active = true;
    const loadFurniture = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SERVER_URL || ""}/api/game/home/${propertyId}/furniture`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const result = await response.json();
        if (active && Array.isArray(result.furniture)) {
          setFurniture(result.furniture);
          window.dispatchEvent(new CustomEvent("life-sim:home-furniture-list", {
            detail: { propertyId, furniture: result.furniture },
          }));
        }
      } catch {
        // The house remains playable if the furniture service is temporarily offline.
      }
    };
    const refresh = () => { void loadFurniture(); };
    void loadFurniture();
    window.addEventListener("life-sim:home-furniture-updated", refresh);
    return () => {
      active = false;
      window.removeEventListener("life-sim:home-furniture-updated", refresh);
    };
  }, [personalHome, propertyId, token]);
  useEffect(() => {
    if (!personalHome || !propertyId) return;
    const sizeByKey: Record<string, [number, number]> = {
      bed_basic: [3.1, 4.2], sofa_basic: [3.2, 1.45], tv_basic: [2.45, 0.7],
      fridge_basic: [1.55, 1.45], stove_basic: [2.3, 1.35], shower_basic: [2.0, 2.0],
      lamp_basic: [1.0, 1.0], desk_basic: [3.0, 1.5], dining_table: [3.8, 1.7],
      bookshelf_basic: [2.0, 0.65],
    };
    setInteriorFurnitureColliders(propertyId, furniture.map((item) => {
      const [width, depth] = sizeByKey[item.furnitureKey] || [1.2, 1.2];
      return {
        id: item.id,
        x: item.x * 0.5,
        z: item.z * 0.5,
        rotation: item.rotation,
        halfWidth: width * 0.25,
        halfDepth: depth * 0.25,
      };
    }));
    return () => setInteriorFurnitureColliders(propertyId, []);
  }, [personalHome, propertyId, furniture]);

  const doorPivot = useRef<THREE.Group>(null);
  const doorTarget = useRef(0);
  const doorTimer = useRef<number | null>(null);
  const style = useMemo(() => {
    if (locationKey.includes("shop") || locationKey === "shop")
      return { floor: "#c4a574", wall: "#f5e6c8", trim: "#9f7955", accent: "#8b6914" };
    if (locationKey === "restaurant")
      return { floor: "#5c4033", wall: "#2d2d2d", trim: "#181818", accent: "#e07a5f" };
    if (locationKey.includes("apartment") || locationKey.includes("house") || personalHome)
      return { floor: "#c7b69c", wall: "#e8e0d5", trim: "#9c8267", accent: "#6b8e6b" };
    if (locationKey === "gym")
      return { floor: "#333", wall: "#444", trim: "#1f2928", accent: "#2a9d8f" };
    if (locationKey === "hospital")
      return { floor: "#e8e8e8", wall: "#f0f7ff", trim: "#b8c8d8", accent: "#4a90d9" };
    if (locationKey === "school" || locationKey === "university")
      return { floor: "#c9b8a0", wall: "#f5f0e8", trim: "#9b886f", accent: "#8b7355" };
    return { floor: "#888", wall: "#aaa", trim: "#666", accent: "#666" };
  }, [locationKey, personalHome]);

  useEffect(() => {
    const onOpen = () => {
      doorTarget.current = -Math.PI / 2;
      if (doorTimer.current !== null) window.clearTimeout(doorTimer.current);
      doorTimer.current = window.setTimeout(() => {
        doorTarget.current = 0;
        doorTimer.current = null;
      }, 1600);
    };
    window.addEventListener("life-sim:interior-door", onOpen);
    return () => {
      window.removeEventListener("life-sim:interior-door", onOpen);
      if (doorTimer.current !== null) window.clearTimeout(doorTimer.current);
    };
  }, [locationKey]);

  useFrame((_, delta) => {
    if (!doorPivot.current) return;
    doorPivot.current.rotation.y = THREE.MathUtils.damp(
      doorPivot.current.rotation.y,
      doorTarget.current,
      10,
      Math.min(delta, 0.05),
    );
  });

  const wallHeight = personalHome ? 6 : 6;
  const doorwayHeight = personalHome ? 4 : 3;
  const doorwayWidth = personalHome ? 2.4 : 2.4;

  return (
    <group scale={personalHome ? 0.5 : 1}>
      {/* The starter home stays empty: this phase adds architectural detail, not furniture. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 16]} />
        <meshStandardMaterial color={style.floor} roughness={0.88} />
      </mesh>

      {/* Subtle floor joints help the rooms read as a real interior at low camera angles. */}
      {Array.from({ length: 20 }, (_, i) => {
        const scale = 1;
        return (
          <mesh key={`floor-joint-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[-9.5 + i * scale, 0.006, 0]}>
            <planeGeometry args={[0.018, 15.5]} />
            <meshStandardMaterial color="#8a7866" roughness={1} />
          </mesh>
        );
      })}

      {/* Exterior walls with a proper front opening for the entry door. */}
      <mesh position={[0, wallHeight / 2, -8]} receiveShadow>
        <boxGeometry args={[20, wallHeight, 0.3]} />
        <meshStandardMaterial color={style.wall} roughness={0.92} />
      </mesh>
      <mesh position={[-10, wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[0.3, wallHeight, 16]} />
        <meshStandardMaterial color={style.wall} roughness={0.92} />
      </mesh>
      <mesh position={[10, wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[0.3, wallHeight, 16]} />
        <meshStandardMaterial color={style.wall} roughness={0.92} />
      </mesh>
      <mesh position={[-5.6, wallHeight / 2, 7.82]} receiveShadow>
        <boxGeometry args={[8.8, wallHeight, 0.3]} />
        <meshStandardMaterial color={style.wall} roughness={0.92} />
      </mesh>
      <mesh position={[5.6, wallHeight / 2, 7.82]} receiveShadow>
        <boxGeometry args={[8.8, wallHeight, 0.3]} />
        <meshStandardMaterial color={style.wall} roughness={0.92} />
      </mesh>

      {/* Room dividers form a living area, bedroom, kitchen zone and a smaller private room. */}
      {personalHome && (
        <group>
          <mesh position={[-6.4, 1.45, -2.25]}>
            <boxGeometry args={[7.2, 2.9, 0.16]} />
            <meshStandardMaterial color={style.wall} roughness={0.95} />
          </mesh>
          <mesh position={[5.2, 1.45, -2.25]}>
            <boxGeometry args={[9.6, 2.9, 0.16]} />
            <meshStandardMaterial color={style.wall} roughness={0.95} />
          </mesh>
          <mesh position={[-2.4, 1.45, -5.05]}>
            <boxGeometry args={[0.16, 2.9, 5.45]} />
            <meshStandardMaterial color={style.wall} roughness={0.95} />
          </mesh>
          <mesh position={[5.2, 1.45, -5.15]}>
            <boxGeometry args={[0.16, 2.9, 5.2]} />
            <meshStandardMaterial color={style.wall} roughness={0.95} />
          </mesh>
          <mesh position={[7.6, 1.45, -6.1]}>
            <boxGeometry args={[4.8, 2.9, 0.16]} />
            <meshStandardMaterial color={style.wall} roughness={0.95} />
          </mesh>
        </group>
      )}

      {/* Wall baseboards and upper trim break up the large flat wall surfaces. */}
      {[-1, 1].map((side) => (
        <group key={`side-trim-${side}`}>
          <mesh position={[side * 9.78, 0.12, 0]}>
            <boxGeometry args={[0.12, 0.24, 15.5]} />
            <meshStandardMaterial color={style.trim} roughness={0.8} />
          </mesh>
          <mesh position={[side * 9.78, wallHeight - 0.15, 0]}>
            <boxGeometry args={[0.12, 0.2, 15.5]} />
            <meshStandardMaterial color={style.trim} roughness={0.8} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.12, -7.78]}>
        <boxGeometry args={[19.5, 0.24, 0.12]} />
        <meshStandardMaterial color={style.trim} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.12, 7.66]}>
        <boxGeometry args={[7.5, 0.24, 0.12]} />
        <meshStandardMaterial color={style.trim} roughness={0.8} />
      </mesh>

      {/* Window glazing sits inside timber frames with a sill and a centre mullion. */}
      {[
        { x: -9.78, y: 3.25, z: -1.8, side: "left" },
        { x: 9.78, y: 3.25, z: -1.8, side: "right" },
      ].map((windowSpec) => (
        <group key={windowSpec.side} position={[windowSpec.x, windowSpec.y, windowSpec.z]}>
          <mesh rotation={[0, windowSpec.side === "left" ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <planeGeometry args={[2.5, 1.55]} />
            <meshStandardMaterial color="#b8dff0" emissive="#77a8c8" emissiveIntensity={0.2} metalness={0.12} roughness={0.18} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.12, 1.75, 0.12]} />
            <meshStandardMaterial color={style.trim} roughness={0.8} />
          </mesh>
        </group>
      ))}
      {[-4.8, 4.8].map((x) => (
        <group key={`back-window-${x}`} position={[x, 3.25, -7.78]}>
          <mesh>
            <boxGeometry args={[2.4, 1.55, 0.08]} />
            <meshStandardMaterial color="#b8dff0" emissive="#77a8c8" emissiveIntensity={0.2} metalness={0.12} roughness={0.18} />
          </mesh>
          <WindowFrame position={[0, 0.83, 0.04]} />
          <WindowFrame position={[0, -0.83, 0.04]} />
          <WindowFrame position={[-1.25, 0, 0.04]} horizontal={false} />
          <WindowFrame position={[1.25, 0, 0.04]} horizontal={false} />
          <mesh position={[0, 0, 0.08]}>
            <boxGeometry args={[0.07, 1.48, 0.07]} />
            <meshStandardMaterial color={style.trim} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.82, 0.12]}>
            <boxGeometry args={[2.75, 0.12, 0.22]} />
            <meshStandardMaterial color={style.trim} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Hinged front door. The Exit action opens it before the scene transition. */}
      <mesh position={[-1.12, doorwayHeight / 2, 7.82]}>
        <boxGeometry args={[0.16, doorwayHeight, 0.22]} />
        <meshStandardMaterial color={style.trim} roughness={0.8} />
      </mesh>
      <mesh position={[1.12, doorwayHeight / 2, 7.82]}>
        <boxGeometry args={[0.16, doorwayHeight, 0.22]} />
        <meshStandardMaterial color={style.trim} roughness={0.8} />
      </mesh>
      <mesh position={[0, doorwayHeight + 0.02, 7.82]}>
        <boxGeometry args={[doorwayWidth, 0.16, 0.22]} />
        <meshStandardMaterial color={style.trim} roughness={0.8} />
      </mesh>
      <group ref={doorPivot} position={[-doorwayWidth / 2, doorwayHeight / 2, 7.73]}>
        <mesh position={[doorwayWidth / 2, 0, 0]} castShadow>
          <boxGeometry args={[doorwayWidth - 0.2, doorwayHeight - 0.14, 0.11]} />
          <meshStandardMaterial color="#65432e" roughness={0.82} />
        </mesh>
        <mesh position={[doorwayWidth - 0.37, 0, 0.075]}>
          <sphereGeometry args={[0.065, 8, 8]} />
          <meshStandardMaterial color="#d8b875" metalness={0.66} roughness={0.28} />
        </mesh>
      </group>

      {/* Public landmark interiors — simple set dressing so shops/hospitals aren't empty boxes */}
      {!personalHome && (locationKey === "shop" || locationKey.includes("shop")) && (
        <group>
          {[-4, 0, 4].map((x) => (
            <mesh key={`shelf-${x}`} position={[x, 1.2, -5.5]} castShadow>
              <boxGeometry args={[3.2, 2.4, 0.6]} />
              <meshStandardMaterial color="#8b6914" roughness={0.8} />
            </mesh>
          ))}
          <mesh position={[0, 0.55, 2]}>
            <boxGeometry args={[4, 1.1, 1.4]} />
            <meshStandardMaterial color="#5c4033" />
          </mesh>
        </group>
      )}
      {!personalHome && locationKey === "hospital" && (
        <group>
          <mesh position={[-3, 0.7, -2]}>
            <boxGeometry args={[2.8, 1.2, 1.6]} />
            <meshStandardMaterial color="#dfe8f0" />
          </mesh>
          <mesh position={[3, 0.7, -2]}>
            <boxGeometry args={[2.8, 1.2, 1.6]} />
            <meshStandardMaterial color="#dfe8f0" />
          </mesh>
          <mesh position={[0, 1.5, -6]}>
            <boxGeometry args={[6, 3, 0.4]} />
            <meshStandardMaterial color="#4a90d9" />
          </mesh>
        </group>
      )}
      {!personalHome && (locationKey === "school" || locationKey === "university") && (
        <group>
          {[-5, -1.5, 2].map((z, i) => (
            <mesh key={`desk-${i}`} position={[-2 + (i % 2) * 4, 0.55, z]}>
              <boxGeometry args={[2.4, 0.9, 1.2]} />
              <meshStandardMaterial color="#8b7355" />
            </mesh>
          ))}
          <mesh position={[0, 1.4, -6.5]}>
            <boxGeometry args={[8, 2.2, 0.15]} />
            <meshStandardMaterial color="#2d3436" />
          </mesh>
        </group>
      )}
      {!personalHome && locationKey === "gym" && (
        <group>
          {[-4, 0, 4].map((x) => (
            <mesh key={`rack-${x}`} position={[x, 0.9, -4]}>
              <boxGeometry args={[2.2, 1.6, 1.2]} />
              <meshStandardMaterial color="#2a9d8f" metalness={0.2} roughness={0.5} />
            </mesh>
          ))}
        </group>
      )}
      {!personalHome && locationKey === "restaurant" && (
        <group>
          {[[-3, -2], [3, -2], [-3, 2], [3, 2]].map(([x, z], i) => (
            <group key={`table-${i}`} position={[x, 0, z]}>
              <mesh position={[0, 0.75, 0]}>
                <cylinderGeometry args={[0.9, 0.9, 0.12, 12]} />
                <meshStandardMaterial color="#5c4033" />
              </mesh>
              <mesh position={[0, 0.35, 0]}>
                <cylinderGeometry args={[0.12, 0.15, 0.7, 8]} />
                <meshStandardMaterial color="#3d2918" />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {!personalHome && locationKey === "police" && (
        <group>
          <mesh position={[0, 0.9, -4]}>
            <boxGeometry args={[5, 1.6, 1.8]} />
            <meshStandardMaterial color="#2c3e6b" />
          </mesh>
          <mesh position={[-4, 1.2, 1]}>
            <boxGeometry args={[2, 2.2, 2]} />
            <meshStandardMaterial color="#3d4a5c" />
          </mesh>
        </group>
      )}

      {/* Purchased furniture is persisted on the property and rendered in the real interior. */}
      {personalHome && furniture.map((item) => (
        <HomeFurnitureObject key={item.id} propertyId={propertyId} item={item} />
      ))}

      {/* Ceiling and simple ceiling lights. Furniture and appliance lights are layered on top. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 6, 0]}>
        <planeGeometry args={[20, 16]} />
        <meshStandardMaterial color="#f1eee8" side={THREE.DoubleSide} roughness={0.95} />
      </mesh>
      <CeilingLight position={[-5, 5.88, -3]} />
      <CeilingLight position={[4.8, 5.88, -3]} />
      <CeilingLight position={[0, 5.88, 3]} />
      <ambientLight intensity={personalHome ? 0.56 : 0.6} color="#fff4e7" />
      <pointLight position={[-5, 5.65, -3]} intensity={0.32} color="#ffe3bd" distance={13} />
      <pointLight position={[4.8, 5.65, -3]} intensity={0.32} color="#ffe3bd" distance={13} />
      <pointLight position={[0, 5.65, 3]} intensity={0.32} color="#ffe3bd" distance={13} />
    </group>
  );
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { useGameStore } from "../stores/gameStore";
import { HomeFurnitureObject, type HomeFurnitureItem } from "./HomeFurniture";
import { setInteriorFurnitureColliders } from "./collisionWorld";
import { MODELS, ModelOrFallback } from "./assetModels";

interface InteriorProps {
  locationKey: string;
}

type RoomStyle = { floor: string; wall: string; trim: string; accent: string; label: string };

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

function BoxProp({
  position,
  size,
  color,
  roughness = 0.85,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  roughness?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

function KitProp({
  url,
  position,
  fit,
  yaw = 0,
  fallback,
}: {
  url: string;
  position: [number, number, number];
  fit?: { width?: number; height?: number; depth?: number };
  yaw?: number;
  fallback: ReactNode;
}) {
  return (
    <group position={position}>
      <ModelOrFallback url={url} fit={fit} yaw={yaw} fallback={fallback} />
    </group>
  );
}

function RoomShell({
  width,
  depth,
  wallHeight,
  style,
  doorwayWidth,
  doorwayHeight,
  doorPivot,
}: {
  width: number;
  depth: number;
  wallHeight: number;
  style: RoomStyle;
  doorwayWidth: number;
  doorwayHeight: number;
  doorPivot: React.RefObject<THREE.Group | null>;
}) {
  const hw = width / 2;
  const hd = depth / 2;
  const frontZ = hd - 0.18;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={style.floor} roughness={0.88} />
      </mesh>
      {/* back */}
      <mesh position={[0, wallHeight / 2, -hd]} receiveShadow>
        <boxGeometry args={[width, wallHeight, 0.3]} />
        <meshStandardMaterial color={style.wall} roughness={0.92} />
      </mesh>
      {/* left / right */}
      <mesh position={[-hw, wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[0.3, wallHeight, depth]} />
        <meshStandardMaterial color={style.wall} roughness={0.92} />
      </mesh>
      <mesh position={[hw, wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[0.3, wallHeight, depth]} />
        <meshStandardMaterial color={style.wall} roughness={0.92} />
      </mesh>
      {/* front split around door */}
      <mesh position={[-(doorwayWidth / 2 + (hw - doorwayWidth / 2) / 2), wallHeight / 2, frontZ]} receiveShadow>
        <boxGeometry args={[hw - doorwayWidth / 2, wallHeight, 0.3]} />
        <meshStandardMaterial color={style.wall} roughness={0.92} />
      </mesh>
      <mesh position={[doorwayWidth / 2 + (hw - doorwayWidth / 2) / 2, wallHeight / 2, frontZ]} receiveShadow>
        <boxGeometry args={[hw - doorwayWidth / 2, wallHeight, 0.3]} />
        <meshStandardMaterial color={style.wall} roughness={0.92} />
      </mesh>
      <mesh position={[0, doorwayHeight + (wallHeight - doorwayHeight) / 2, frontZ]} receiveShadow>
        <boxGeometry args={[doorwayWidth, wallHeight - doorwayHeight, 0.3]} />
        <meshStandardMaterial color={style.wall} roughness={0.92} />
      </mesh>
      <mesh position={[-doorwayWidth / 2 - 0.08, doorwayHeight / 2, frontZ]}>
        <boxGeometry args={[0.16, doorwayHeight, 0.22]} />
        <meshStandardMaterial color={style.trim} roughness={0.8} />
      </mesh>
      <mesh position={[doorwayWidth / 2 + 0.08, doorwayHeight / 2, frontZ]}>
        <boxGeometry args={[0.16, doorwayHeight, 0.22]} />
        <meshStandardMaterial color={style.trim} roughness={0.8} />
      </mesh>
      <group ref={doorPivot} position={[-doorwayWidth / 2, doorwayHeight / 2, frontZ - 0.09]}>
        <mesh position={[doorwayWidth / 2, 0, 0]} castShadow>
          <boxGeometry args={[doorwayWidth - 0.2, doorwayHeight - 0.14, 0.11]} />
          <meshStandardMaterial color="#65432e" roughness={0.82} />
        </mesh>
        <mesh position={[doorwayWidth - 0.37, 0, 0.075]}>
          <sphereGeometry args={[0.065, 8, 8]} />
          <meshStandardMaterial color="#d8b875" metalness={0.66} roughness={0.28} />
        </mesh>
      </group>
      {/* ceiling */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, wallHeight, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#f1eee8" side={THREE.DoubleSide} roughness={0.95} />
      </mesh>
      <Text position={[0, wallHeight - 0.6, -hd + 0.2]} fontSize={0.45} color={style.accent} anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000">
        {style.label}
      </Text>
    </group>
  );
}

function ShopLayout({ style }: { style: RoomStyle }) {
  const shelf = (x: number, z: number) => (
    <KitProp
      key={`shelf-${x}-${z}`}
      url={MODELS.bookcase}
      position={[x, 0, z]}
      fit={{ width: 2.2, height: 2.2, depth: 0.6 }}
      fallback={<BoxProp position={[0, 1.1, 0]} size={[2.2, 2.2, 0.55]} color={style.accent} />}
    />
  );
  return (
    <group>
      {[-5, -1.5, 2].map((x) => shelf(x, -5.2))}
      {[-5, 2].map((x) => shelf(x, -2.2))}
      <KitProp
        url={MODELS.table}
        position={[0, 0, 2.2]}
        fit={{ width: 2.4, height: 1.0, depth: 1.2 }}
        fallback={<BoxProp position={[0, 0.55, 0]} size={[3.2, 1.1, 1.3]} color="#5c4033" />}
      />
      <BoxProp position={[6.2, 1.2, 0]} size={[0.4, 2.4, 4]} color={style.trim} />
    </group>
  );
}

function RestaurantLayout({ style }: { style: RoomStyle }) {
  const tables: [number, number][] = [
    [-4, -3],
    [0, -3],
    [4, -3],
    [-4, 1.5],
    [0, 1.5],
    [4, 1.5],
  ];
  return (
    <group>
      {tables.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <KitProp
            url={MODELS.table}
            position={[0, 0, 0]}
            fit={{ width: 1.6, height: 0.9, depth: 1.6 }}
            fallback={
              <group>
                <mesh position={[0, 0.75, 0]}>
                  <cylinderGeometry args={[0.85, 0.85, 0.1, 12]} />
                  <meshStandardMaterial color="#5c4033" />
                </mesh>
                <mesh position={[0, 0.35, 0]}>
                  <cylinderGeometry args={[0.1, 0.14, 0.7, 8]} />
                  <meshStandardMaterial color="#3d2918" />
                </mesh>
              </group>
            }
          />
          <KitProp
            url={MODELS.chair}
            position={[0.9, 0, 0]}
            yaw={-Math.PI / 2}
            fit={{ width: 0.7, height: 1.0, depth: 0.7 }}
            fallback={<BoxProp position={[0, 0.45, 0]} size={[0.55, 0.9, 0.55]} color="#3d2918" />}
          />
        </group>
      ))}
      <BoxProp position={[0, 1.1, -6.5]} size={[10, 2.2, 0.5]} color={style.accent} />
    </group>
  );
}

function HospitalLayout({ style }: { style: RoomStyle }) {
  return (
    <group>
      <BoxProp position={[0, 0.9, -5.5]} size={[8, 1.8, 1.4]} color="#dfe8f0" />
      <Text position={[0, 2.0, -5.5]} fontSize={0.28} color={style.accent} anchorX="center">
        Reception
      </Text>
      {([-5, 0, 5] as number[]).map((x) => (
        <KitProp
          key={x}
          url={MODELS.bed}
          position={[x, 0, 1.5]}
          fit={{ width: 2.4, height: 1.2, depth: 3.2 }}
          fallback={<BoxProp position={[0, 0.55, 0]} size={[2.2, 1.1, 3]} color="#dfe8f0" />}
        />
      ))}
      <BoxProp position={[-7.5, 1.5, -2]} size={[0.2, 3, 6]} color="#c5d4e4" />
      <BoxProp position={[7.5, 1.5, -2]} size={[0.2, 3, 6]} color="#c5d4e4" />
    </group>
  );
}

function SchoolLayout({ style }: { style: RoomStyle }) {
  const desks: [number, number][] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      desks.push([-4.5 + col * 3, -3.5 + row * 2.4]);
    }
  }
  return (
    <group>
      <BoxProp position={[0, 1.5, -6.6]} size={[12, 2.4, 0.12]} color="#2d3436" />
      <Text position={[0, 1.5, -6.45]} fontSize={0.35} color="#ecf0f1" anchorX="center">
        Classroom
      </Text>
      {desks.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <KitProp
            url={MODELS.desk}
            position={[0, 0, 0]}
            fit={{ width: 1.8, height: 0.9, depth: 0.9 }}
            fallback={<BoxProp position={[0, 0.5, 0]} size={[1.8, 0.85, 0.9]} color={style.accent} />}
          />
          <KitProp
            url={MODELS.deskChair}
            position={[0, 0, 0.85]}
            fit={{ width: 0.6, height: 0.95, depth: 0.6 }}
            fallback={<BoxProp position={[0, 0.4, 0]} size={[0.5, 0.8, 0.5]} color="#5c4033" />}
          />
        </group>
      ))}
      <KitProp
        url={MODELS.bookcase}
        position={[7.2, 0, -4]}
        fit={{ width: 1.5, height: 2.4, depth: 0.5 }}
        fallback={<BoxProp position={[0, 1.2, 0]} size={[1.4, 2.4, 0.5]} color={style.trim} />}
      />
    </group>
  );
}

function GymLayout({ style }: { style: RoomStyle }) {
  return (
    <group>
      {([-5, 0, 5] as number[]).map((x) => (
        <BoxProp key={x} position={[x, 0.95, -4]} size={[2.4, 1.9, 1.4]} color={style.accent} />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 2]} receiveShadow>
        <planeGeometry args={[10, 6]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
      </mesh>
      <Text position={[0, 2.5, -6.5]} fontSize={0.4} color={style.accent} anchorX="center">
        FREE WEIGHTS
      </Text>
      <BoxProp position={[7, 0.4, 2]} size={[1.5, 0.8, 3]} color="#222" />
      <BoxProp position={[-7, 0.4, 2]} size={[1.5, 0.8, 3]} color="#222" />
    </group>
  );
}

function PoliceLayout({ style }: { style: RoomStyle }) {
  return (
    <group>
      <BoxProp position={[0, 0.95, -4]} size={[6, 1.9, 2]} color={style.accent} />
      <Text position={[0, 2.2, -4]} fontSize={0.3} color="#fff" anchorX="center">
        Front desk
      </Text>
      <BoxProp position={[-6, 1.4, 1]} size={[2.5, 2.8, 2.5]} color="#3d4a5c" />
      <Text position={[-6, 3.0, 1]} fontSize={0.25} color="#b2bec3" anchorX="center">
        Holding
      </Text>
      <KitProp
        url={MODELS.desk}
        position={[5, 0, 2]}
        fit={{ width: 2.2, height: 1.0, depth: 1.1 }}
        fallback={<BoxProp position={[0, 0.55, 0]} size={[2.2, 1.1, 1.1]} color="#2c3e6b" />}
      />
      <KitProp
        url={MODELS.deskChair}
        position={[5, 0, 3.2]}
        fit={{ width: 0.7, height: 1.0, depth: 0.7 }}
        fallback={<BoxProp position={[0, 0.45, 0]} size={[0.55, 0.9, 0.55]} color="#1a2744" />}
      />
    </group>
  );
}

function ApartmentLayout({ style }: { style: RoomStyle }) {
  return (
    <group>
      <KitProp
        url={MODELS.bed}
        position={[-4, 0, -3]}
        fit={{ width: 2.6, height: 1.2, depth: 3.2 }}
        fallback={<BoxProp position={[0, 0.5, 0]} size={[2.4, 1.0, 3]} color="#8b7355" />}
      />
      <KitProp
        url={MODELS.sofa}
        position={[3.5, 0, -2]}
        fit={{ width: 2.8, height: 1.2, depth: 1.2 }}
        fallback={<BoxProp position={[0, 0.5, 0]} size={[2.6, 1.0, 1.1]} color={style.accent} />}
      />
      <KitProp
        url={MODELS.fridge}
        position={[5.5, 0, 3]}
        fit={{ width: 1.0, height: 2.0, depth: 1.0 }}
        fallback={<BoxProp position={[0, 1.0, 0]} size={[1.0, 2.0, 1.0]} color="#cfd8dc" />}
      />
      <KitProp
        url={MODELS.table}
        position={[-2, 0, 3]}
        fit={{ width: 1.8, height: 0.9, depth: 1.2 }}
        fallback={<BoxProp position={[0, 0.45, 0]} size={[1.8, 0.9, 1.2]} color={style.trim} />}
      />
    </group>
  );
}

function resolveKind(locationKey: string, personalHome: boolean): string {
  if (personalHome) return "home";
  if (locationKey.includes("shop") || locationKey === "shop") return "shop";
  if (locationKey === "restaurant") return "restaurant";
  if (locationKey === "hospital") return "hospital";
  if (locationKey === "school" || locationKey === "university") return "school";
  if (locationKey === "gym") return "gym";
  if (locationKey === "police") return "police";
  if (locationKey.includes("apartment") || locationKey.includes("house")) return "apartment";
  return "generic";
}

function styleFor(kind: string): RoomStyle {
  switch (kind) {
    case "shop":
      return { floor: "#c4a574", wall: "#f5e6c8", trim: "#9f7955", accent: "#8b6914", label: "GENERAL STORE" };
    case "restaurant":
      return { floor: "#5c4033", wall: "#2d2d2d", trim: "#181818", accent: "#e07a5f", label: "RESTAURANT" };
    case "hospital":
      return { floor: "#e8e8e8", wall: "#f0f7ff", trim: "#b8c8d8", accent: "#4a90d9", label: "HOSPITAL" };
    case "school":
      return { floor: "#c9b8a0", wall: "#f5f0e8", trim: "#9b886f", accent: "#8b7355", label: "SCHOOL" };
    case "gym":
      return { floor: "#333", wall: "#444", trim: "#1f2928", accent: "#2a9d8f", label: "GYM" };
    case "police":
      return { floor: "#3d4a5c", wall: "#2c3e6b", trim: "#1a2744", accent: "#74b9ff", label: "POLICE" };
    case "apartment":
    case "home":
      return { floor: "#c7b69c", wall: "#e8e0d5", trim: "#9c8267", accent: "#6b8e6b", label: "HOME" };
    default:
      return { floor: "#888", wall: "#aaa", trim: "#666", accent: "#666", label: "INTERIOR" };
  }
}

export function Interior({ locationKey }: InteriorProps) {
  const personalHome = locationKey.startsWith("home_");
  const propertyId = personalHome ? locationKey.slice("home_".length) : "";
  const token = useGameStore((state) => state.token);
  const [furniture, setFurniture] = useState<HomeFurnitureItem[]>([]);

  const kind = resolveKind(locationKey, personalHome);
  const style = useMemo(() => styleFor(kind), [kind]);

  // Distinct footprints
  const dims = useMemo(() => {
    switch (kind) {
      case "shop":
        return { width: 18, depth: 14, wallHeight: 5.5 };
      case "restaurant":
        return { width: 18, depth: 14, wallHeight: 5.2 };
      case "hospital":
        return { width: 22, depth: 16, wallHeight: 5.5 };
      case "school":
        return { width: 20, depth: 16, wallHeight: 5.5 };
      case "gym":
        return { width: 20, depth: 16, wallHeight: 6 };
      case "police":
        return { width: 18, depth: 14, wallHeight: 5.2 };
      case "home":
        return { width: 20, depth: 16, wallHeight: 6 };
      default:
        return { width: 16, depth: 14, wallHeight: 5.5 };
    }
  }, [kind]);

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
          window.dispatchEvent(
            new CustomEvent("life-sim:home-furniture-list", {
              detail: { propertyId, furniture: result.furniture },
            }),
          );
        }
      } catch {
        /* offline-safe */
      }
    };
    const refresh = () => {
      void loadFurniture();
    };
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
      bed_basic: [3.1, 4.2],
      sofa_basic: [3.2, 1.45],
      tv_basic: [2.45, 0.7],
      fridge_basic: [1.55, 1.45],
      stove_basic: [2.3, 1.35],
      shower_basic: [2.0, 2.0],
      lamp_basic: [1.0, 1.0],
      desk_basic: [3.0, 1.5],
      dining_table: [3.8, 1.7],
      bookshelf_basic: [2.0, 0.65],
    };
    setInteriorFurnitureColliders(
      propertyId,
      furniture.map((item) => {
        const [width, depth] = sizeByKey[item.furnitureKey] || [1.2, 1.2];
        return {
          id: item.id,
          x: item.x * 0.5,
          z: item.z * 0.5,
          rotation: item.rotation,
          halfWidth: width * 0.25,
          halfDepth: depth * 0.25,
        };
      }),
    );
    return () => setInteriorFurnitureColliders(propertyId, []);
  }, [personalHome, propertyId, furniture]);

  const doorPivot = useRef<THREE.Group>(null);
  const doorTarget = useRef(0);
  const doorTimer = useRef<number | null>(null);

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

  const doorwayHeight = personalHome ? 4 : 3;
  const doorwayWidth = 2.4;
  const scale = personalHome ? 0.5 : 1;

  return (
    <group scale={scale}>
      <RoomShell
        width={dims.width}
        depth={dims.depth}
        wallHeight={dims.wallHeight}
        style={style}
        doorwayWidth={doorwayWidth}
        doorwayHeight={doorwayHeight}
        doorPivot={doorPivot}
      />

      {kind === "shop" && <ShopLayout style={style} />}
      {kind === "restaurant" && <RestaurantLayout style={style} />}
      {kind === "hospital" && <HospitalLayout style={style} />}
      {kind === "school" && <SchoolLayout style={style} />}
      {kind === "gym" && <GymLayout style={style} />}
      {kind === "police" && <PoliceLayout style={style} />}
      {(kind === "apartment" || (kind === "home" && !personalHome)) && <ApartmentLayout style={style} />}

      {/* Personal home room dividers */}
      {personalHome && (
        <group>
          <mesh position={[-6.4, 1.45, -2.25]}>
            <boxGeometry args={[7.2, 2.9, 0.16]} />
            <meshStandardMaterial color={style.wall} roughness={0.95} />
          </mesh>
          <mesh position={[5.2, 1.45, -2.25]}>
            <boxGeometry args={[6.0, 2.9, 0.16]} />
            <meshStandardMaterial color={style.wall} roughness={0.95} />
          </mesh>
          <mesh position={[0, 1.45, 2.4]}>
            <boxGeometry args={[0.16, 2.9, 7]} />
            <meshStandardMaterial color={style.wall} roughness={0.95} />
          </mesh>
        </group>
      )}

      {personalHome &&
        furniture.map((item) => <HomeFurnitureObject key={item.id} propertyId={propertyId} item={item} />)}

      <CeilingLight position={[-4, dims.wallHeight - 0.12, -3]} />
      <CeilingLight position={[4, dims.wallHeight - 0.12, -3]} />
      <CeilingLight position={[0, dims.wallHeight - 0.12, 3]} />
      <ambientLight intensity={personalHome ? 0.56 : 0.62} color="#fff4e7" />
      <pointLight position={[-4, dims.wallHeight - 0.35, -3]} intensity={0.32} color="#ffe3bd" distance={14} />
      <pointLight position={[4, dims.wallHeight - 0.35, -3]} intensity={0.32} color="#ffe3bd" distance={14} />
      <pointLight position={[0, dims.wallHeight - 0.35, 3]} intensity={0.32} color="#ffe3bd" distance={14} />
    </group>
  );
}

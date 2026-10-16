import { Suspense } from "react";
import * as THREE from "three";
import { AssetBoundary, FittedModel, MODELS, type ModelFit } from "./assetModels";

export interface HomeFurnitureItem {
  id: string;
  furnitureKey: string;
  x: number;
  z: number;
  rotation: number;
  isOn?: boolean;
  lastUsedAt?: string;
}

interface Props {
  propertyId: string;
  item: HomeFurnitureItem;
}

const wood = "#8b6042";
const darkWood = "#4f3728";
const fabric = "#678b83";
const metal = "#a8b0b4";

function Box({ position, size, color, roughness = 0.82, emissive, emissiveIntensity = 0 }: {
  position: [number, number, number]; size: [number, number, number]; color: string;
  roughness?: number; emissive?: string; emissiveIntensity?: number;
}) {
  return <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={roughness} emissive={emissive} emissiveIntensity={emissiveIntensity} />
  </mesh>;
}

function LegSet({ positions, height = 0.8, color = darkWood }: { positions: Array<[number, number]>; height?: number; color?: string }) {
  return <>{positions.map(([x, z], index) => <Box key={index} position={[x, height / 2, z]} size={[0.13, height, 0.13]} color={color} />)}</>;
}

function LegacyFurnitureShape({ item }: { item: HomeFurnitureItem }) {
  const key = item.furnitureKey;
  if (key === "bed_basic") return <group>
    <Box position={[0, 0.28, 0]} size={[3.1, 0.45, 4.2]} color={darkWood} />
    <Box position={[0, 0.56, -0.12]} size={[2.9, 0.22, 3.9]} color="#eee5d7" />
    <Box position={[0, 0.72, -1.48]} size={[2.7, 0.28, 0.9]} color="#9eb7ca" />
    <Box position={[-0.82, 0.91, -1.58]} size={[0.8, 0.24, 0.58]} color="#f7f2e8" />
    <Box position={[0.82, 0.91, -1.58]} size={[0.8, 0.24, 0.58]} color="#f7f2e8" />
  </group>;

  if (key === "sofa_basic") return <group>
    <Box position={[0, 0.48, 0.1]} size={[3.2, 0.55, 1.45]} color={fabric} />
    <Box position={[0, 1.05, -0.47]} size={[3.2, 1.05, 0.36]} color="#4d716a" />
    <Box position={[-1.48, 0.82, 0.02]} size={[0.34, 0.85, 1.3]} color="#4d716a" />
    <Box position={[1.48, 0.82, 0.02]} size={[0.34, 0.85, 1.3]} color="#4d716a" />
    <Box position={[-0.63, 0.79, 0.08]} size={[0.07, 0.42, 0.08]} color="#b9c5b2" />
    <Box position={[0.63, 0.79, 0.08]} size={[0.07, 0.42, 0.08]} color="#b9c5b2" />
  </group>;

  if (key === "tv_basic") return <group>
    <Box position={[0, 0.6, 0.18]} size={[2.4, 0.16, 0.62]} color={wood} />
    <LegSet positions={[[-1, 0.1], [1, 0.1]]} height={0.5} />
    <Box position={[0, 1.52, -0.04]} size={[2.45, 1.48, 0.16]} color="#161c22" roughness={0.2} />
    <Box position={[0, 1.52, 0.055]} size={[2.25, 1.25, 0.035]} color="#182e3c" roughness={0.2} emissive="#22516b" emissiveIntensity={0.26} />
    <Box position={[0, 0.82, -0.02]} size={[0.35, 0.36, 0.25]} color={metal} />
  </group>;

  if (key === "fridge_basic") return <group>
    <Box position={[0, 1.35, 0]} size={[1.55, 2.7, 1.45]} color="#d7e0e5" roughness={0.36} />
    <Box position={[0, 1.85, 0.74]} size={[1.43, 0.025, 0.03]} color="#a9b5bc" />
    <Box position={[0.52, 1.38, 0.76]} size={[0.07, 0.66, 0.06]} color="#7d8a91" roughness={0.45} />
    <Box position={[0.52, 2.15, 0.76]} size={[0.07, 0.32, 0.06]} color="#7d8a91" roughness={0.45} />
  </group>;

  if (key === "stove_basic") return <group>
    <Box position={[0, 0.52, 0]} size={[2.25, 0.85, 1.25]} color="#e4e7e7" />
    <Box position={[0, 1.0, 0]} size={[2.3, 0.15, 1.35]} color="#383f43" roughness={0.38} />
    {[[-0.62, -0.34], [0.62, -0.34], [-0.62, 0.34], [0.62, 0.34]].map(([x, z], i) => <mesh key={i} position={[x, 1.09, z]}>
      <cylinderGeometry args={[0.23, 0.23, 0.055, 16]} /><meshStandardMaterial color="#15191c" metalness={0.35} roughness={0.45} />
    </mesh>)}
    <Box position={[0, 0.36, 0.66]} size={[2.0, 0.12, 0.08]} color={metal} />
  </group>;

  if (key === "shower_basic") return <group>
    <Box position={[0, 0.12, 0]} size={[2.0, 0.22, 2.0]} color="#e6edf0" />
    <Box position={[-0.93, 1.55, 0]} size={[0.08, 2.85, 1.95]} color="#c2dae4" roughness={0.22} />
    <Box position={[0.93, 1.55, 0]} size={[0.08, 2.85, 1.95]} color="#c2dae4" roughness={0.22} />
    <Box position={[0, 2.95, -0.9]} size={[1.9, 0.08, 0.08]} color={metal} />
    <Box position={[0.55, 2.58, -0.82]} size={[0.08, 0.72, 0.08]} color={metal} />
    <mesh position={[0.55, 2.18, -0.82]} rotation={[Math.PI / 2.8, 0, 0]}><cylinderGeometry args={[0.28, 0.34, 0.12, 12]} /><meshStandardMaterial color={metal} metalness={0.55} roughness={0.3} /></mesh>
  </group>;

  if (key === "lamp_basic") return <group>
    <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.46, 0.52, 0.18, 16]} /><meshStandardMaterial color={darkWood} /></mesh>
    <mesh position={[0, 1.1, 0]}><cylinderGeometry args={[0.08, 0.08, 1.85, 12]} /><meshStandardMaterial color={metal} metalness={0.45} roughness={0.38} /></mesh>
    <mesh position={[0, 2.2, 0]}><cylinderGeometry args={[0.26, 0.58, 0.72, 16, 1, true]} /><meshStandardMaterial color="#f0d9a0" emissive={item.isOn === false ? "#000000" : "#ffdc83"} emissiveIntensity={item.isOn === false ? 0 : 0.65} side={THREE.DoubleSide} /></mesh>
    {item.isOn !== false && <pointLight position={[0, 2.0, 0]} intensity={0.45} color="#ffd993" distance={8} />}
  </group>;

  if (key === "desk_basic") return <group>
    <Box position={[0, 1.0, 0]} size={[3.0, 0.18, 1.5]} color={wood} />
    <LegSet positions={[[-1.25, -0.55], [1.25, -0.55], [-1.25, 0.55], [1.25, 0.55]]} height={1.0} />
    <Box position={[0, 1.68, -0.35]} size={[1.45, 0.92, 0.12]} color="#222a32" />
    <Box position={[0, 1.68, -0.27]} size={[1.27, 0.74, 0.025]} color="#4d91a8" emissive="#2e6f89" emissiveIntensity={0.2} roughness={0.3} />
    <Box position={[0, 1.17, 0.28]} size={[1.15, 0.05, 0.45]} color="#d6d9dd" />
    {/* A real chair gives the seated computer animation somewhere to land. */}
    <Box position={[0, 0.50, 1.12]} size={[0.86, 0.14, 0.72]} color="#303943" />
    <Box position={[0, 0.88, 1.43]} size={[0.82, 0.72, 0.13]} color="#394652" />
    <Box position={[0, 0.27, 1.12]} size={[0.12, 0.40, 0.12]} color="#8a969f" />
    <Box position={[-0.23, 0.10, 0.90]} size={[0.07, 0.18, 0.07]} color="#262d34" />
    <Box position={[0.23, 0.10, 0.90]} size={[0.07, 0.18, 0.07]} color="#262d34" />
    <Box position={[-0.23, 0.10, 1.34]} size={[0.07, 0.18, 0.07]} color="#262d34" />
    <Box position={[0.23, 0.10, 1.34]} size={[0.07, 0.18, 0.07]} color="#262d34" />
  </group>;

  if (key === "dining_table") return <group>
    <Box position={[0, 1.0, 0]} size={[2.9, 0.18, 1.7]} color={wood} />
    <LegSet positions={[[-1.15, -0.62], [1.15, -0.62], [-1.15, 0.62], [1.15, 0.62]]} height={1.0} />
    <Box position={[-1.7, 0.52, 0]} size={[0.48, 0.12, 1.0]} color={fabric} />
    <Box position={[1.7, 0.52, 0]} size={[0.48, 0.12, 1.0]} color={fabric} />
    <Box position={[-1.86, 0.93, -0.38]} size={[0.12, 0.8, 0.12]} color={darkWood} />
    <Box position={[1.86, 0.93, -0.38]} size={[0.12, 0.8, 0.12]} color={darkWood} />
  </group>;

  if (key === "bookshelf_basic") return <group>
    <Box position={[0, 1.45, 0]} size={[2.0, 2.9, 0.55]} color={darkWood} />
    {[0.6, 1.35, 2.1].map((y) => <Box key={y} position={[0, y, 0.31]} size={[1.8, 0.1, 0.62]} color={wood} />)}
    {Array.from({ length: 13 }, (_, i) => <Box key={i} position={[-0.78 + (i % 7) * 0.25, 0.91 + Math.floor(i / 7) * 0.75, 0.27]} size={[0.16, 0.45 + ((i % 3) * 0.05), 0.32]} color={["#b96e52", "#4e7188", "#d5bd74", "#7d9b78"][i % 4]} />)}
  </group>;

  return null;
}

function Part({ url, fit, x = 0, y = 0, z = 0, yaw = 0 }: { url: string; fit: ModelFit; x?: number; y?: number; z?: number; yaw?: number }) {
  return <group position={[x, y, z]}><FittedModel url={url} fit={fit} yaw={yaw} /></group>;
}

/** Furniture built from the Kenney furniture kit. Models face +Z with backs toward -Z, like the old boxes. */
function ModelFurnitureShape({ item }: { item: HomeFurnitureItem }) {
  switch (item.furnitureKey) {
    case "bed_basic":
      return <Part url={MODELS.bed} fit={{ width: 3.1 }} />;
    case "sofa_basic":
      return <Part url={MODELS.sofa} fit={{ width: 3.2 }} />;
    case "tv_basic":
      return <group>
        <Part url={MODELS.tvCabinet} fit={{ width: 2.6 }} />
        <Part url={MODELS.tv} fit={{ width: 1.9 }} y={1.0} z={-0.05} />
      </group>;
    case "fridge_basic":
      return <Part url={MODELS.fridge} fit={{ height: 2.8 }} />;
    case "stove_basic":
      return <Part url={MODELS.stove} fit={{ height: 1.3 }} />;
    case "shower_basic":
      return <Part url={MODELS.shower} fit={{ height: 3.0 }} />;
    case "lamp_basic":
      return <group>
        <Part url={MODELS.floorLamp} fit={{ height: 2.6 }} />
        {item.isOn !== false && <pointLight position={[0, 2.0, 0]} intensity={0.45} color="#ffd993" distance={8} />}
      </group>;
    case "desk_basic":
      return <group>
        <Part url={MODELS.desk} fit={{ width: 2.6 }} />
        <Part url={MODELS.screen} fit={{ width: 1.0 }} y={1.35} z={-0.3} />
        <Part url={MODELS.keyboard} fit={{ width: 0.8 }} y={1.35} z={0.2} />
        <Part url={MODELS.deskChair} fit={{ height: 1.5 }} z={1.2} />
      </group>;
    case "dining_table":
      return <group>
        <Part url={MODELS.table} fit={{ width: 2.9 }} />
        <Part url={MODELS.chair} fit={{ height: 1.3 }} x={-1.85} yaw={Math.PI / 2} />
        <Part url={MODELS.chair} fit={{ height: 1.3 }} x={1.85} yaw={-Math.PI / 2} />
      </group>;
    case "bookshelf_basic":
      return <Part url={MODELS.bookcase} fit={{ height: 2.7 }} />;
    default:
      throw new Error("no model for " + item.furnitureKey);
  }
}

/** Kenney model when available; the original box furniture while loading or if a file is missing. */
function FurnitureShape({ item }: { item: HomeFurnitureItem }) {
  const legacy = <LegacyFurnitureShape item={item} />;
  return (
    <AssetBoundary fallback={legacy}>
      <Suspense fallback={legacy}>
        <ModelFurnitureShape item={item} />
      </Suspense>
    </AssetBoundary>
  );
}

export function HomeFurnitureObject({ propertyId, item }: Props) {
  function interact(e: any) {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("life-sim:interact-furniture", { detail: { propertyId, furniture: item } }));
  }
  const defName = item.furnitureKey.replaceAll("_", " ");
  return <group position={[item.x, 0, item.z]} rotation={[0, item.rotation, 0]} onClick={interact}
    onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
    onPointerOut={() => { document.body.style.cursor = "auto"; }} userData={{ furnitureId: item.id, name: defName }}>
    <FurnitureShape item={item} />
  </group>;
}

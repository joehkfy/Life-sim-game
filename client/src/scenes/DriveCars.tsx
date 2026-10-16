/**
 * Parked cars on the road grid — walk up and steal/drive them.
 * E / USE = enter nearest car, F / USE again = exit.
 * Uses Kenney car GLBs already in public/models/world/cars.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MODELS, ModelOrFallback } from "./assetModels";
import { useGameStore } from "../stores/gameStore";
import { useInputStore } from "../stores/inputStore";

const VEHICLE_YAW = Math.PI; // Kenney cars face -Z by default
const ENTER_RANGE = 4.2;
const DRIVE_SPEED = 18;
const DRIVE_BOOST = 28;

export type ParkedCar = {
  id: string;
  x: number;
  z: number;
  yaw: number;
  url: string;
  color: string;
  stolen: boolean;
};

/** Shared driving state so Player can read speed without prop drilling. */
export const driveState = {
  active: false,
  carId: null as string | null,
  speed: 0,
  carPos: { x: 0, z: 0, yaw: 0 },
};

function buildParkedFleet(): ParkedCar[] {
  // Sit on the kerb of the GRID roads (±14, ±28) and main avenue shoulders
  const lanes = [
    { x: 5.5, z: 18, yaw: 0 },
    { x: -5.5, z: -22, yaw: Math.PI },
    { x: 18, z: 5.5, yaw: Math.PI / 2 },
    { x: -22, z: -5.5, yaw: -Math.PI / 2 },
    { x: 14 + 4.2, z: 28, yaw: 0 },
    { x: -14 - 4.2, z: -14, yaw: Math.PI },
    { x: 28, z: 14 + 4.2, yaw: Math.PI / 2 },
    { x: -28, z: -14 - 4.2, yaw: -Math.PI / 2 },
    { x: 7.5, z: -35, yaw: 0 },
    { x: -32, z: 8, yaw: Math.PI / 2 },
    { x: 35, z: -8, yaw: -Math.PI / 2 },
    { x: -8, z: 32, yaw: Math.PI },
  ];
  const pool = [
    MODELS.sedan,
    MODELS.sedanSports,
    MODELS.hatchback,
    MODELS.suv,
    MODELS.suvLuxury,
    MODELS.taxi,
    MODELS.van,
    MODELS.sedanCustom,
  ];
  const colors = ["#d85149", "#e5e8ed", "#476d9c", "#4d9479", "#eabd3d", "#9d6bb0", "#454b55", "#c47a5a"];
  return lanes.map((p, i) => ({
    id: `parked-${i}`,
    x: p.x,
    z: p.z,
    yaw: p.yaw,
    url: pool[i % pool.length],
    color: colors[i % colors.length],
    stolen: false,
  }));
}

function nearestCar(cars: ParkedCar[], px: number, pz: number): ParkedCar | null {
  let best: ParkedCar | null = null;
  let bestD = ENTER_RANGE;
  for (const c of cars) {
    if (c.stolen && driveState.carId !== c.id) continue;
    const d = Math.hypot(c.x - px, c.z - pz);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function DriveCars() {
  const [cars, setCars] = useState(() => buildParkedFleet());
  const [prompt, setPrompt] = useState<string | null>(null);
  const promptRef = useRef<HTMLDivElement | null>(null);
  const drivingRef = useRef(false);
  const activeCar = useRef<ParkedCar | null>(null);
  const carGroup = useRef<THREE.Group>(null);

  // Desktop: E enter / F exit. Mobile: reuse USE via life-sim:interact
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyE") tryEnter();
      if (e.code === "KeyF") tryExit();
    };
    const onInteract = () => {
      if (drivingRef.current) tryExit();
      else tryEnter();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("life-sim:interact", onInteract);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("life-sim:interact", onInteract);
    };
  }, [cars]);

  function tryEnter() {
    if (drivingRef.current) return;
    const ch = useGameStore.getState().character;
    if (!ch || ch.location !== "city") return;
    const pos = ch.position || { x: 0, z: 0 };
    const near = nearestCar(cars, pos.x, pos.z);
    if (!near) return;
    drivingRef.current = true;
    activeCar.current = near;
    driveState.active = true;
    driveState.carId = near.id;
    driveState.speed = DRIVE_SPEED;
    driveState.carPos = { x: near.x, z: near.z, yaw: near.yaw };
    setCars((prev) => prev.map((c) => (c.id === near.id ? { ...c, stolen: true } : c)));
    setPrompt("Driving — WASD/stick · Shift boost · F or USE to exit");
    try {
      localStorage.setItem("life-sim-vehicle-speed", String(DRIVE_SPEED));
    } catch {
      /* ignore */
    }
  }

  function tryExit() {
    if (!drivingRef.current || !activeCar.current) return;
    const car = activeCar.current;
    // Leave car where player stopped
    const ch = useGameStore.getState().character;
    const px = ch?.position?.x ?? car.x;
    const pz = ch?.position?.z ?? car.z;
    setCars((prev) =>
      prev.map((c) =>
        c.id === car.id ? { ...c, x: px, z: pz, yaw: driveState.carPos.yaw, stolen: false } : c
      )
    );
    drivingRef.current = false;
    activeCar.current = null;
    driveState.active = false;
    driveState.carId = null;
    driveState.speed = 0;
    setPrompt(null);
    try {
      localStorage.removeItem("life-sim-vehicle-speed");
    } catch {
      /* ignore */
    }
  }

  useFrame((_, delta) => {
    const ch = useGameStore.getState().character;
    if (!ch || ch.location !== "city") {
      setPrompt(null);
      return;
    }
    const pos = ch.position || { x: 0, z: 0 };

    if (drivingRef.current && activeCar.current) {
      // Sync parked visual to player while driving (Player still owns movement)
      const yaw = ch.rotation ?? driveState.carPos.yaw;
      driveState.carPos = { x: pos.x, z: pos.z, yaw };
      activeCar.current = { ...activeCar.current, x: pos.x, z: pos.z, yaw };
      // Boost on run
      const input = useInputStore.getState();
      const boost = input.mobileRun;
      driveState.speed = boost ? DRIVE_BOOST : DRIVE_SPEED;
      try {
        localStorage.setItem("life-sim-vehicle-speed", String(driveState.speed));
      } catch {
        /* ignore */
      }
      return;
    }

    const near = nearestCar(cars, pos.x, pos.z);
    if (near) setPrompt(`Press E / USE to steal ${near.id.replace("parked-", "car #")}`);
    else setPrompt(null);
  });

  // HUD prompt
  useEffect(() => {
    let el = document.getElementById("life-sim-drive-prompt") as HTMLDivElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = "life-sim-drive-prompt";
      el.style.cssText =
        "position:fixed;bottom:22%;left:50%;transform:translateX(-50%);z-index:40;padding:8px 14px;border-radius:12px;background:rgba(10,14,22,.82);color:#e8eef8;font:600 13px/1.3 system-ui;pointer-events:none;display:none;border:1px solid rgba(255,255,255,.12)";
      document.body.appendChild(el);
    }
    promptRef.current = el;
    return () => {
      el?.remove();
    };
  }, []);

  useEffect(() => {
    const el = promptRef.current;
    if (!el) return;
    if (prompt) {
      el.textContent = prompt;
      el.style.display = "block";
    } else {
      el.style.display = "none";
    }
  }, [prompt]);

  const visibleCars = useMemo(() => cars.filter((c) => !(c.stolen && driveState.carId === c.id)), [cars]);

  return (
    <group>
      {cars.map((c) => {
        // While driving this car, follow player (invisible parked body — player is the car)
        const drivingThis = driveState.active && driveState.carId === c.id;
        const x = drivingThis ? driveState.carPos.x : c.x;
        const z = drivingThis ? driveState.carPos.z : c.z;
        const yaw = drivingThis ? driveState.carPos.yaw : c.yaw;
        return (
          <group key={c.id} position={[x, 0.05, z]} rotation={[0, yaw, 0]}>
            <ModelOrFallback
              url={c.url}
              fit={{ depth: 2.4 }}
              yaw={VEHICLE_YAW}
              shadows
              fallback={
                <mesh position={[0, 0.45, 0]} castShadow>
                  <boxGeometry args={[1.2, 0.5, 2.3]} />
                  <meshStandardMaterial color={c.color} roughness={0.5} metalness={0.15} />
                </mesh>
              }
            />
          </group>
        );
      })}
    </group>
  );
}

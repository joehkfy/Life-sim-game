import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CharacterAppearance } from "@life-sim/shared";
import { useGameStore } from "../stores/gameStore";
import { RiggedAvatar } from "./RiggedAvatar";

/**
 * Local ambient simulation for the city: scheduled residents, traffic signals,
 * lightweight vehicles and weather effects. Residents use the same GLB rig and
 * animation controller as player characters. Their simulation is visual/local;
 * no fake persistent economy or server-owned NPC state is implied.
 */

type DestinationKey = "home" | "shop" | "restaurant" | "school" | "university" | "hospital" | "police" | "gym" | "park";
type ResidentRole = "student" | "shopkeeper" | "office_worker" | "health_worker" | "police_officer" | "fitness_coach" | "shopper" | "night_worker";
interface ResidentDefinition {
  id: string;
  name: string;
  role: ResidentRole;
  appearance: CharacterAppearance;
  shirt: string;
  pants: string;
  home: [number, number, number];
  seed: number;
}
interface ResidentSchedule {
  key: string;
  destination: DestinationKey;
  target: [number, number, number];
  activity: string;
  hideAtDestination: boolean;
  speed: number;
  message: string;
}
interface ResidentSummary {
  id: string;
  name: string;
  role: ResidentRole;
  activity: string;
  cityKey: string;
  message: string;
}

const ROAD_COORDS = [-35, -21, -7, 7, 21, 35] as const;
// Targets match shared BUILDINGS so NPC paths and enterable landmarks stay aligned.
const DESTINATIONS: Record<DestinationKey, { target: [number, number, number]; road: [number, number]; name: string }> = {
  home: { target: [20, 0, -8], road: [21, -7], name: "Apartments" },
  shop: { target: [-18, 0, 15], road: [-21, 14], name: "General Store" },
  restaurant: { target: [18, 0, 12], road: [21, 14], name: "Restaurant" },
  school: { target: [-25, 0, -20], road: [-21, -21], name: "School" },
  university: { target: [30, 0, -25], road: [35, -21], name: "University" },
  hospital: { target: [-30, 0, 25], road: [-35, 21], name: "Hospital" },
  police: { target: [25, 0, 28], road: [35, 21], name: "Police Station" },
  gym: { target: [-22, 0, -5], road: [-21, -7], name: "Gym" },
  park: { target: [0, 0, 0], road: [-7, -7], name: "Central Park" },
};

const RESIDENT_SEEDS: Array<{
  name: string;
  role: ResidentRole;
  shirt: string;
  pants: string;
  hair: string;
  skin: number;
  hairStyle: number;
}> = [
  { name: "Amara Okafor", role: "student", shirt: "#d97745", pants: "#273650", hair: "#241914", skin: 0.68, hairStyle: 1 },
  { name: "Daniel Reed", role: "office_worker", shirt: "#416a9d", pants: "#27303a", hair: "#30231b", skin: 0.55, hairStyle: 0 },
  { name: "Mei Lin", role: "student", shirt: "#b96f9e", pants: "#36415b", hair: "#201b1c", skin: 0.52, hairStyle: 2 },
  { name: "Tunde Adebayo", role: "shopkeeper", shirt: "#4d8675", pants: "#3a342e", hair: "#211a16", skin: 0.77, hairStyle: 1 },
  { name: "Sofia Martins", role: "health_worker", shirt: "#72a7c9", pants: "#f0f2f4", hair: "#71462d", skin: 0.48, hairStyle: 3 },
  { name: "Kenji Sato", role: "office_worker", shirt: "#6774a7", pants: "#252d3b", hair: "#211c1b", skin: 0.54, hairStyle: 0 },
  { name: "Zara Bello", role: "fitness_coach", shirt: "#9b554b", pants: "#333c46", hair: "#211611", skin: 0.74, hairStyle: 2 },
  { name: "Noah Williams", role: "police_officer", shirt: "#304d7d", pants: "#222d43", hair: "#443025", skin: 0.43, hairStyle: 0 },
  { name: "Priya Shah", role: "shopper", shirt: "#d2a34b", pants: "#55506b", hair: "#35251f", skin: 0.57, hairStyle: 3 },
  { name: "Chidi Nwosu", role: "night_worker", shirt: "#577c9b", pants: "#2b3038", hair: "#231a14", skin: 0.78, hairStyle: 1 },
  { name: "Layla Hassan", role: "health_worker", shirt: "#8070a6", pants: "#373a49", hair: "#2e2018", skin: 0.63, hairStyle: 2 },
  { name: "Ethan Clarke", role: "shopper", shirt: "#6e9b55", pants: "#333d35", hair: "#503323", skin: 0.45, hairStyle: 0 },
  { name: "Nneka Eze", role: "shopkeeper", shirt: "#be6d64", pants: "#3b3b4e", hair: "#1f1715", skin: 0.75, hairStyle: 3 },
  { name: "Oliver Chen", role: "night_worker", shirt: "#a36b4d", pants: "#262c37", hair: "#211d1b", skin: 0.51, hairStyle: 0 },
];


function makeResidents(): ResidentDefinition[] {
  return RESIDENT_SEEDS.map((p, i) => {
    const seed = i + 1;
    const homeCandidates: Array<[number, number, number]> = [
      [-35, 0, -21], [-21, 0, 35], [-7, 0, 35], [7, 0, -35],
      [21, 0, -7], [35, 0, -21], [-35, 0, 21], [7, 0, 35],
      [-21, 0, -7], [35, 0, 7], [-7, 0, 21], [21, 0, 35],
      [-35, 0, -7], [35, 0, 21],
    ];
    return {
      id: `resident-${i + 1}`,
      name: p.name,
      role: p.role,
      shirt: p.shirt,
      pants: p.pants,
      home: homeCandidates[i],
      seed,
      appearance: {
        skinTone: p.skin,
        hairStyle: p.hairStyle,
        hairColor: p.hair,
        facePreset: i % 4,
        clothingTop: i % 8,
        clothingBottom: (i + 3) % 8,
        accessories: [],
      },
    };
  });
}

const RESIDENTS = makeResidents();

function getSchedule(resident: ResidentDefinition, hour: number, weather: string): ResidentSchedule {
  const role = resident.role;
  const night = hour < 5.5 || hour >= 22.5;
  if (role === "night_worker") {
    if (hour >= 18 || hour < 1) {
      const destination: DestinationKey = resident.id.endsWith("14") ? "restaurant" : "police";
      return { key: `night-shift-${destination}`, destination, target: DESTINATIONS[destination].target, activity: "Working late", hideAtDestination: true, speed: 1.55, message: "I'm on the evening shift." };
    }
    if (hour >= 5.5 && hour < 7.5) return { key: "night-worker-home", destination: "home", target: DESTINATIONS.home.target, activity: "Heading home", hideAtDestination: true, speed: 1.35, message: "I'm heading home after work." };
    if (hour >= 16 && hour < 18) return { key: "night-worker-park", destination: "park", target: [6.5, 0, 5], activity: "Taking a break", hideAtDestination: false, speed: 1.35, message: "I'm getting some fresh air before work." };
    return { key: "night-worker-sleep", destination: "home", target: DESTINATIONS.home.target, activity: "Resting at home", hideAtDestination: true, speed: 1.3, message: "I work nights, so I'm resting now." };
  }
  if (night) return { key: "sleep-home", destination: "home", target: DESTINATIONS.home.target, activity: "At home", hideAtDestination: true, speed: 1.3, message: "It's late. I'm heading home." };

  if (role === "student") {
    if (hour >= 7.5 && hour < 15.5) return { key: "school-day", destination: resident.id === "resident-3" ? "university" : "school", target: DESTINATIONS[resident.id === "resident-3" ? "university" : "school"].target, activity: "Studying", hideAtDestination: true, speed: 1.55, message: "I'm on my way to class." };
    if (hour >= 6 && hour < 7.5) return { key: "school-commute", destination: "school", target: DESTINATIONS.school.target, activity: "Going to class", hideAtDestination: true, speed: 2.05, message: "I don't want to be late for class." };
  }
  if (role === "shopkeeper" && hour >= 8 && hour < 18) return { key: "shop-shift", destination: "shop", target: DESTINATIONS.shop.target, activity: "Working at the store", hideAtDestination: true, speed: 1.5, message: "The shop is open today." };
  if (role === "office_worker" && hour >= 8 && hour < 17) return { key: "office-shift", destination: "university", target: DESTINATIONS.university.target, activity: "At work", hideAtDestination: true, speed: 1.55, message: "I'm on my way to work." };
  if (role === "health_worker" && hour >= 7 && hour < 19) return { key: "hospital-shift", destination: "hospital", target: DESTINATIONS.hospital.target, activity: "Working at the hospital", hideAtDestination: true, speed: 1.65, message: "It's a busy day at the hospital." };
  if (role === "police_officer" && hour >= 7 && hour < 19) return { key: "police-shift", destination: "police", target: DESTINATIONS.police.target, activity: "On duty", hideAtDestination: true, speed: 1.65, message: "I'm on duty. Stay safe." };
  if (role === "fitness_coach" && hour >= 7 && hour < 16) return { key: "gym-shift", destination: "gym", target: DESTINATIONS.gym.target, activity: "Coaching at the gym", hideAtDestination: true, speed: 1.75, message: "I'm heading to the gym." };

  if (hour >= 16 && hour < 18.5) {
    if (weather === "stormy" || weather === "rainy") return { key: "rainy-shop", destination: "shop", target: DESTINATIONS.shop.target, activity: "Shopping indoors", hideAtDestination: true, speed: 1.45, message: "I'm staying indoors while the weather is bad." };
    if (role === "fitness_coach") return { key: "coach-park", destination: "park", target: [6.5, 0, -5], activity: "Cooling down in the park", hideAtDestination: false, speed: 1.6, message: "A little fresh air after training feels good." };
    return { key: "afternoon-shopping", destination: "shop", target: DESTINATIONS.shop.target, activity: "Shopping", hideAtDestination: true, speed: 1.45, message: "I'm picking up a few things." };
  }
  if (hour >= 18.5 && hour < 21.5) {
    if (weather === "stormy" || weather === "rainy") return { key: "rainy-dinner", destination: "restaurant", target: DESTINATIONS.restaurant.target, activity: "Having dinner", hideAtDestination: true, speed: 1.45, message: "It's better to have dinner indoors tonight." };
    if (resident.seed % 3 === 0) return { key: "evening-park", destination: "park", target: [-6.5, 0, 5], activity: "Relaxing in the park", hideAtDestination: false, speed: 1.4, message: "The park is peaceful this evening." };
    return { key: "evening-dinner", destination: "restaurant", target: DESTINATIONS.restaurant.target, activity: "Having dinner", hideAtDestination: true, speed: 1.5, message: "I'm meeting someone for dinner." };
  }
  if (hour >= 5.5 && hour < 7) {
    return { key: "morning-walk", destination: "park", target: [6.5, 0, 5], activity: "Morning walk", hideAtDestination: false, speed: 1.6, message: "It's a good morning for a walk." };
  }
  if (role === "shopper" && hour >= 9 && hour < 16) {
    const dest: DestinationKey = resident.seed % 2 === 0 ? "shop" : "park";
    return { key: `day-${dest}`, destination: dest, target: dest === "park" ? [-6.5, 0, -5] : DESTINATIONS.shop.target, activity: dest === "park" ? "Enjoying the park" : "Shopping", hideAtDestination: dest !== "park", speed: 1.4, message: dest === "park" ? "I like spending time outdoors." : "I'm looking for something in the store." };
  }
  return { key: "free-time-park", destination: "park", target: [6.5, 0, -5], activity: "Taking a walk", hideAtDestination: false, speed: 1.45, message: "I'm just exploring the neighbourhood." };
}

function nearestRoadNode(position: THREE.Vector3 | [number, number, number]): [number, number] {
  const x = Array.isArray(position) ? position[0] : position.x;
  const z = Array.isArray(position) ? position[2] : position.z;
  let best: [number, number] = [ROAD_COORDS[0], ROAD_COORDS[0]];
  let distance = Infinity;
  for (const rx of ROAD_COORDS) for (const rz of ROAD_COORDS) {
    const d = (x - rx) ** 2 + (z - rz) ** 2;
    if (d < distance) { distance = d; best = [rx, rz]; }
  }
  return best;
}

function pathOnRoads(from: [number, number], to: [number, number]): Array<[number, number]> {
  const key = (x: number, z: number) => `${x},${z}`;
  const queue: Array<[number, number]> = [from];
  const previous = new Map<string, string | null>([[key(from[0], from[1]), null]]);
  while (queue.length) {
    const [x, z] = queue.shift()!;
    if (x === to[0] && z === to[1]) break;
    const neighbours: Array<[number, number]> = [];
    const xi = ROAD_COORDS.indexOf(x as (typeof ROAD_COORDS)[number]);
    const zi = ROAD_COORDS.indexOf(z as (typeof ROAD_COORDS)[number]);
    if (xi > 0) neighbours.push([ROAD_COORDS[xi - 1], z]);
    if (xi < ROAD_COORDS.length - 1) neighbours.push([ROAD_COORDS[xi + 1], z]);
    if (zi > 0) neighbours.push([x, ROAD_COORDS[zi - 1]]);
    if (zi < ROAD_COORDS.length - 1) neighbours.push([x, ROAD_COORDS[zi + 1]]);
    for (const next of neighbours) {
      const k = key(next[0], next[1]);
      if (previous.has(k)) continue;
      previous.set(k, key(x, z));
      queue.push(next);
    }
  }
  const result: Array<[number, number]> = [];
  let cursor: string | null = key(to[0], to[1]);
  while (cursor) {
    const [x, z] = cursor.split(",").map(Number);
    result.push([x, z]);
    cursor = previous.get(cursor) ?? null;
  }
  return result.reverse();
}

function makeRoute(start: THREE.Vector3, destination: DestinationKey, target: [number, number, number]) {
  const startNode = nearestRoadNode(start);
  const targetNode = DESTINATIONS[destination].road;
  const path = pathOnRoads(startNode, targetNode);
  const points: THREE.Vector3[] = [];
  if (start.distanceTo(new THREE.Vector3(startNode[0], 0, startNode[1])) > 0.6) points.push(new THREE.Vector3(startNode[0], 0, startNode[1]));
  path.slice(1).forEach(([x, z]) => points.push(new THREE.Vector3(x, 0, z)));
  const last = new THREE.Vector3(target[0], 0, target[2]);
  if (!points.length || points[points.length - 1].distanceTo(last) > 0.7) points.push(last);
  return points;
}

function ResidentActor({ resident, worldTime, weather, cityKey, onSelect }: {
  resident: ResidentDefinition;
  worldTime: number;
  weather: string;
  cityKey: string;
  onSelect: (summary: ResidentSummary) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const activity = useMemo(() => getSchedule(resident, worldTime, weather), [resident, Math.floor(worldTime * 2) / 2, weather]);
  const route = useRef<THREE.Vector3[]>([]);
  const routeIndex = useRef(0);
  const hidden = useRef(false);
  const pauseUntil = useRef(0);
  const resumeAnimation = useRef("idle");
  const actionUntil = useRef(0);
  const [animation, setAnimation] = useState("idle");
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const current = group.current?.position.clone() ?? new THREE.Vector3(...resident.home);
    route.current = makeRoute(current, activity.destination, activity.target);
    routeIndex.current = 0;
    hidden.current = false;
    setIsVisible(true);
    setAnimation("walk");
    resumeAnimation.current = activity.hideAtDestination ? "idle" : activity.activity.toLowerCase().includes("park") ? "sit" : "idle";
  }, [activity.key, activity.destination, resident]);

  useEffect(() => {
    const onCommand = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; action: string }>).detail;
      if (detail?.id !== resident.id) return;
      const action = detail.action === "greet" ? "wave" : detail.action === "talk" ? "talk" : "look_at";
      pauseUntil.current = performance.now() + (detail.action === "greet" ? 1550 : 2800);
      actionUntil.current = pauseUntil.current;
      setAnimation(action);
    };
    window.addEventListener("life-sim:resident-command", onCommand);
    return () => window.removeEventListener("life-sim:resident-command", onCommand);
  }, [resident.id]);

  useFrame((_, delta) => {
    const root = group.current;
    if (!root) return;
    const dt = Math.min(delta, 0.05);
    const now = performance.now();
    if (now < pauseUntil.current) return;
    if (actionUntil.current && now >= actionUntil.current) {
      actionUntil.current = 0;
      setAnimation(routeIndex.current < route.current.length ? "walk" : resumeAnimation.current);
    }
    if (hidden.current) return;
    if (routeIndex.current < route.current.length) {
      const target = route.current[routeIndex.current];
      const dx = target.x - root.position.x;
      const dz = target.z - root.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.42) {
        routeIndex.current += 1;
        if (routeIndex.current >= route.current.length) {
          if (activity.hideAtDestination) {
            hidden.current = true;
            setIsVisible(false);
          }
          setAnimation(resumeAnimation.current);
        }
      } else {
        const signal = trafficState(worldTime);
        const crossesMainRoadAlongX = root.position.x * target.x < 0 && Math.abs(root.position.z) >= 6.1 && Math.abs(root.position.z) <= 8.4 && Math.abs(dz) < 0.55;
        const crossesMainRoadAlongZ = root.position.z * target.z < 0 && Math.abs(root.position.x) >= 6.1 && Math.abs(root.position.x) <= 8.4 && Math.abs(dx) < 0.55;
        if (crossesMainRoadAlongX && signal.verticalGreen) {
          root.position.x = dx > 0 ? Math.min(root.position.x, -2.6) : Math.max(root.position.x, 2.6);
          setAnimation((current) => current === "idle" ? current : "idle");
          return;
        }
        if (crossesMainRoadAlongZ && signal.horizontalGreen) {
          root.position.z = dz > 0 ? Math.min(root.position.z, -2.6) : Math.max(root.position.z, 2.6);
          setAnimation((current) => current === "idle" ? current : "idle");
          return;
        }
        const step = Math.min(distance, activity.speed * dt);
        root.position.x += dx / distance * step;
        root.position.z += dz / distance * step;
        root.rotation.y = THREE.MathUtils.damp(root.rotation.y, Math.atan2(dx, dz), 7, dt);
        setAnimation((current) => current === "walk" ? current : "walk");
      }
    }
  });

  const summary: ResidentSummary = { id: resident.id, name: resident.name, role: resident.role, activity: activity.activity, cityKey, message: activity.message };
  return (
    <group
      ref={group}
      position={resident.home}
      visible={isVisible}
      onClick={(event) => { event.stopPropagation(); onSelect(summary); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    >
      <RiggedAvatar appearance={resident.appearance} shirtColor={resident.shirt} pantsColor={resident.pants} animation={animation} />
      <Text position={[0, 2.12, 0]} fontSize={0.22} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.018} outlineColor="#18222c">
        {resident.name}
      </Text>
    </group>
  );
}

interface TrafficConfig {
  id: string;
  axis: "x" | "z";
  direction: 1 | -1;
  lane: number;
  start: number;
  speed: number;
  color: string;
  kind?: "car" | "taxi" | "bus";
}

function carConfigs(mobile: boolean): TrafficConfig[] {
  // lane = fixed X when driving N/S (axis z), fixed Z when driving E/W (axis x).
  // Stay on painted roads: main cross (±1.65) and local streets at ±21 (City.tsx).
  const base: TrafficConfig[] = [
    { id: "z-north-1", axis: "z" as const, direction: 1 as const, lane: -1.65, start: -88, speed: 6.7, color: "#d85149" },
    { id: "z-south-1", axis: "z" as const, direction: -1 as const, lane: 1.65, start: 90, speed: 7.4, color: "#e5e8ed" },
    { id: "z-north-2", axis: "z" as const, direction: 1 as const, lane: -1.65, start: -55, speed: 5.9, color: "#476d9c" },
    { id: "z-south-2", axis: "z" as const, direction: -1 as const, lane: 1.65, start: 54, speed: 6.4, color: "#e0b95f" },
    { id: "x-east-1", axis: "x" as const, direction: 1 as const, lane: 1.65, start: -92, speed: 7.1, color: "#4d9479" },
    { id: "x-west-1", axis: "x" as const, direction: -1 as const, lane: -1.65, start: 86, speed: 6.2, color: "#9d6bb0" },
    { id: "x-east-2", axis: "x" as const, direction: 1 as const, lane: 1.65, start: -58, speed: 6.6, color: "#d6d8dc" },
    { id: "x-west-2", axis: "x" as const, direction: -1 as const, lane: -1.65, start: 53, speed: 7.5, color: "#454b55", kind: "car" as const },
    { id: "city-taxi", axis: "z" as const, direction: 1 as const, lane: 1.65, start: -24, speed: 4.8, color: "#eabd3d", kind: "taxi" as const },
    { id: "city-bus", axis: "x" as const, direction: -1 as const, lane: 1.65, start: 30, speed: 4.2, color: "#3b7e9c", kind: "bus" as const },
    { id: "z-local-w", axis: "z" as const, direction: 1 as const, lane: -21, start: -70, speed: 5.5, color: "#6a8fad" },
    { id: "z-local-e", axis: "z" as const, direction: -1 as const, lane: 21, start: 62, speed: 5.8, color: "#c47a5a" },
    { id: "x-local-n", axis: "x" as const, direction: 1 as const, lane: -21, start: -66, speed: 5.4, color: "#7a9b6e" },
    { id: "x-local-s", axis: "x" as const, direction: -1 as const, lane: 21, start: 58, speed: 5.6, color: "#8b7bb0" },
  ];
  return mobile ? base.filter((_, i) => [0, 2, 8, 9, 10].includes(i)) : base;
}

function trafficState(worldTime: number) {
  const phase = ((worldTime * 100) % 34 + 34) % 34;
  const verticalGreen = phase < 15;
  const verticalAmber = phase >= 15 && phase < 17;
  const horizontalGreen = phase >= 17 && phase < 32;
  const horizontalAmber = phase >= 32;
  return { verticalGreen, verticalAmber, horizontalGreen, horizontalAmber };
}

function TrafficCar({ config, worldTime, night, weather }: {
  config: ReturnType<typeof carConfigs>[number];
  worldTime: number;
  night: boolean;
  weather: string;
}) {
  const group = useRef<THREE.Group>(null);
  const coord = useRef(config.start);
  const stopped = useRef(false);
  const inIntersection = useRef(false);
  const [isStopped, setIsStopped] = useState(false);
  useFrame((_, delta) => {
    const root = group.current;
    if (!root) return;
    const dt = Math.min(delta, 0.05);
    const signal = trafficState(worldTime);
    const green = config.axis === "z" ? signal.verticalGreen : signal.horizontalGreen;
    const weatherFactor = weather === "stormy" ? 0.62 : weather === "rainy" ? 0.82 : weather === "cloudy" ? 0.94 : 1;
    let next = coord.current + config.direction * config.speed * weatherFactor * dt;
    if (!inIntersection.current) {
      if (!green && config.direction > 0 && coord.current <= -4.25 && coord.current > -4.6) next = -4.3;
      else if (!green && config.direction < 0 && coord.current >= 4.25 && coord.current < 4.6) next = 4.3;
      else if (!green && config.direction > 0 && coord.current < -4.3 && next >= -4.3) next = -4.3;
      else if (!green && config.direction < 0 && coord.current > 4.3 && next <= 4.3) next = 4.3;
      else if (green && config.direction > 0 && coord.current <= -4.3 && next > -4.3) inIntersection.current = true;
      else if (green && config.direction < 0 && coord.current >= 4.3 && next < 4.3) inIntersection.current = true;
    } else if ((config.direction > 0 && next >= 4.3) || (config.direction < 0 && next <= -4.3)) {
      inIntersection.current = false;
    }
    const nowStopped = Math.abs(next - coord.current) < 0.0001;
    if (nowStopped !== stopped.current) { stopped.current = nowStopped; setIsStopped(nowStopped); }
    coord.current = next;
    if (coord.current > 110) coord.current = -110;
    if (coord.current < -110) coord.current = 110;
    if (config.axis === "z") {
      root.position.set(config.lane, 0, coord.current);
      root.rotation.y = config.direction > 0 ? 0 : Math.PI;
    } else {
      root.position.set(coord.current, 0, config.lane);
      root.rotation.y = config.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  });
  return (
    <group ref={group} position={config.axis === "z" ? [config.lane, 0, config.start] : [config.start, 0, config.lane]}>
      <mesh position={[0, config.kind === "bus" ? 0.67 : 0.48, 0]} castShadow>
        <boxGeometry args={[config.kind === "bus" ? 1.48 : 1.22, config.kind === "bus" ? 0.82 : 0.48, config.kind === "bus" ? 3.7 : config.kind === "taxi" ? 2.0 : 2.3]} />
        <meshStandardMaterial color={config.color} roughness={0.48} metalness={0.12} />
      </mesh>
      <mesh position={[0, config.kind === "bus" ? 1.13 : 0.81, config.kind === "bus" ? -0.15 : -0.13]}>
        <boxGeometry args={[config.kind === "bus" ? 1.25 : 0.94, config.kind === "bus" ? 0.44 : 0.42, config.kind === "bus" ? 2.65 : 1.06]} />
        <meshStandardMaterial color="#9ab9ca" roughness={0.18} metalness={0.12} transparent opacity={0.86} />
      </mesh>
      {config.kind === "taxi" && <mesh position={[0, 0.94, -0.02]}><boxGeometry args={[0.34, 0.06, 0.2]} /><meshStandardMaterial color="#fff2b3" emissive="#f2c94c" emissiveIntensity={0.6} /></mesh>}
      {[-(config.kind === "bus" ? 0.70 : 0.57), config.kind === "bus" ? 0.70 : 0.57].map((x) => (
        <group key={x}>
          <mesh position={[x, config.kind === "bus" ? 0.43 : 0.25, config.kind === "bus" ? 1.81 : 0.69]}>
            <boxGeometry args={[0.16, 0.10, 0.035]} />
            <meshStandardMaterial color="#fff2c4" emissive="#ffe7a0" emissiveIntensity={night ? 2.3 : 0.14} />
          </mesh>
          <mesh position={[x, config.kind === "bus" ? 0.46 : 0.27, config.kind === "bus" ? -1.83 : -1.15]}>
            <boxGeometry args={[0.16, 0.10, 0.035]} />
            <meshStandardMaterial color="#d94135" emissive="#d94135" emissiveIntensity={isStopped ? 1.35 : night ? 0.8 : 0.1} />
          </mesh>
          {[-(config.kind === "bus" ? 1.25 : 0.76), config.kind === "bus" ? 1.25 : 0.76].map((z) => (
            <mesh key={z} position={[x, config.kind === "bus" ? 0.35 : 0.28, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[config.kind === "bus" ? 0.22 : 0.19, config.kind === "bus" ? 0.22 : 0.19, 0.10, 12]} />
              <meshStandardMaterial color="#1c2329" roughness={0.98} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function TrafficLights({ worldTime }: { worldTime: number }) {
  const signal = trafficState(worldTime);
  const lights = [
    { x: -6.7, z: -6.7, green: signal.verticalGreen, amber: signal.verticalAmber },
    { x: 6.7, z: 6.7, green: signal.verticalGreen, amber: signal.verticalAmber },
    { x: -6.7, z: 6.7, green: signal.horizontalGreen, amber: signal.horizontalAmber },
    { x: 6.7, z: -6.7, green: signal.horizontalGreen, amber: signal.horizontalAmber },
  ];
  return <group>{lights.map((light, index) => (
    <group key={index} position={[light.x, 0, light.z]}>
      <mesh position={[0, 2, 0]}><cylinderGeometry args={[0.075, 0.10, 4, 8]} /><meshStandardMaterial color="#333b40" roughness={0.82} /></mesh>
      <mesh position={[0, 4.05, 0]}><boxGeometry args={[0.34, 0.95, 0.28]} /><meshStandardMaterial color="#20272d" roughness={0.85} /></mesh>
      {[0, 1, 2].map((i) => {
        const active = i === 0 ? !light.green && !light.amber : i === 1 ? light.amber : light.green;
        const bulbColor = i === 0 ? "#e34b48" : i === 1 ? "#f4bd49" : "#38e47c";
        return <mesh key={i} position={[0, 4.34 - i * 0.29, 0.16]}>
          <sphereGeometry args={[0.083, 10, 8]} />
          <meshStandardMaterial color={bulbColor} emissive={bulbColor} emissiveIntensity={active ? 1.35 : 0.025} />
        </mesh>;
      })}
    </group>
  ))}</group>;
}

function BusStops() {
  const stops = [[6.8, 25], [-6.8, -25]] as const;
  return <group>{stops.map(([x, z], index) => <group key={index} position={[x, 0, z]}>
    <mesh position={[0, 1.15, 0]}><cylinderGeometry args={[0.045, 0.06, 2.3, 7]} /><meshStandardMaterial color="#3d464c" metalness={0.3} roughness={0.6} /></mesh>
    <mesh position={[0, 2.25, 0]}><boxGeometry args={[0.48, 0.45, 0.12]} /><meshStandardMaterial color="#e1f3f7" roughness={0.5} /></mesh>
    <mesh position={[0, 2.25, 0.067]}><planeGeometry args={[0.35, 0.31]} /><meshStandardMaterial color="#2d6b8b" emissive="#15384c" emissiveIntensity={0.15} /></mesh>
    <mesh position={[0, 0.52, -0.5]}><boxGeometry args={[1.7, 0.12, 0.48]} /><meshStandardMaterial color="#687a7e" roughness={0.9} /></mesh>
    {[-0.58, 0.58].map((leg) => <mesh key={leg} position={[leg, 0.25, -0.5]}><boxGeometry args={[0.08, 0.5, 0.08]} /><meshStandardMaterial color="#454d50" /></mesh>)}
    <Text position={[0, 2.25, 0.14]} fontSize={0.12} color="#ffffff" anchorX="center" anchorY="middle">BUS</Text>
  </group>)}</group>;
}

function WeatherEffects({ weather }: { weather: string }) {
  const { camera } = useThree();
  const group = useRef<THREE.Group>(null);
  const lines = useRef<THREE.LineSegments>(null);
  const flashLight = useRef<THREE.PointLight>(null);
  const dropCount = typeof window !== "undefined" && (window.innerWidth < 900 || "ontouchstart" in window) ? 180 : 420;
  const coords = useMemo(() => {
    const arr = new Float32Array(dropCount * 2 * 3);
    for (let i = 0; i < dropCount; i++) {
      const x = (Math.random() - 0.5) * 42;
      const y = Math.random() * 30;
      const z = (Math.random() - 0.5) * 42;
      arr.set([x, y, z, x - 0.16, y - 0.72, z], i * 6);
    }
    return arr;
  }, [dropCount]);
  const nextFlash = useRef(0);
  const flashEnds = useRef(0);
  useEffect(() => {
    const position = lines.current?.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (position) position.needsUpdate = true;
  }, [coords]);

  useFrame((_, delta) => {
    if (group.current) group.current.position.copy(camera.position);
    const active = weather === "rainy" || weather === "stormy";
    if (group.current) group.current.visible = active;
    const dt = Math.min(delta, 0.05);
    if (active && lines.current) {
      const attr = lines.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < dropCount; i++) {
        const offset = i * 6;
        arr[offset + 1] -= dt * (weather === "stormy" ? 27 : 20);
        arr[offset + 4] = arr[offset + 1] - 0.72;
        arr[offset] -= dt * 1.7;
        arr[offset + 3] = arr[offset] - 0.16;
        if (arr[offset + 1] < -2) {
          arr[offset] = (Math.random() - 0.5) * 42;
          arr[offset + 1] = 18 + Math.random() * 14;
          arr[offset + 2] = (Math.random() - 0.5) * 42;
          arr[offset + 3] = arr[offset] - 0.16;
          arr[offset + 4] = arr[offset + 1] - 0.72;
          arr[offset + 5] = arr[offset + 2];
        }
      }
      attr.needsUpdate = true;
      if (lines.current.material instanceof THREE.LineBasicMaterial) lines.current.material.opacity = weather === "stormy" ? 0.62 : 0.42;
    }
    if (flashLight.current) {
      if (weather === "stormy") {
        const now = performance.now();
        if (!nextFlash.current) nextFlash.current = now + 7000 + Math.random() * 5000;
        if (now >= nextFlash.current) {
          flashEnds.current = now + 100;
          nextFlash.current = now + 6000 + Math.random() * 11000;
        }
        flashLight.current.intensity = now < flashEnds.current ? 3.4 : 0;
      } else flashLight.current.intensity = 0;
    }
  });

  return (
    <group ref={group}>
      <lineSegments ref={lines} frustumCulled={false}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[coords, 3]} /></bufferGeometry>
        <lineBasicMaterial color="#dbeeff" transparent opacity={0.45} depthWrite={false} />
      </lineSegments>
      <pointLight ref={flashLight} position={[0, 15, 0]} color="#d6e6ff" intensity={0} distance={100} decay={1.5} />
    </group>
  );
}

type DialogueTurn = { role: "user" | "assistant"; content: string };
const API = import.meta.env.VITE_SERVER_URL || "";

function ResidentInteractionPanel({ worldTime, weather }: { worldTime: number; weather: string }) {
  const token = useGameStore((s) => s.token);
  const [resident, setResident] = useState<ResidentSummary | null>(null);
  const [history, setHistory] = useState<DialogueTurn[]>([]);
  const [reply, setReply] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogueMode, setDialogueMode] = useState<"groq" | "local" | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<ResidentSummary>).detail;
      if (detail?.id) {
        requestId.current += 1;
        setResident(detail);
        setHistory([]);
        setReply("");
        setDraft("");
        setLoading(false);
        setDialogueMode(null);
      }
    };
    window.addEventListener("life-sim:resident-selected", listener);
    return () => window.removeEventListener("life-sim:resident-selected", listener);
  }, []);

  if (!resident) return null;

  const close = () => {
    requestId.current += 1;
    setResident(null);
    setLoading(false);
  };

  const sendMessage = async (rawText: string, animation: "greet" | "talk" = "talk") => {
    const message = rawText.trim().slice(0, 500);
    if (!message || loading) return;
    if (!token) { setReply("Please sign in again before talking to residents."); return; }

    const thisRequest = ++requestId.current;
    const previousHistory = history;
    setReply("");
    setLoading(true);
    setDialogueMode(null);
    window.dispatchEvent(new CustomEvent("life-sim:resident-command", { detail: { id: resident.id, action: animation } }));

    try {
      const response = await fetch(`${API}/api/game/npc/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          residentId: resident.id,
          residentName: resident.name,
          residentRole: resident.role,
          activity: resident.activity,
          cityKey: resident.cityKey,
          weather,
          worldTime,
          message,
          history: previousHistory.slice(-8),
        }),
      });
      const data = await response.json().catch(() => ({} as { reply?: string; mode?: "groq" | "local"; error?: string }));
      if (!response.ok) throw new Error(data.error || "The resident could not hear you. Please try again.");
      const answer = typeof data.reply === "string" && data.reply.trim() ? data.reply.trim() : "Sorry, I lost my train of thought. Could you say that again?";
      if (thisRequest === requestId.current) {
        setHistory([...previousHistory, { role: "user", content: message }, { role: "assistant", content: answer }].slice(-8));
        setDialogueMode(data.mode === "groq" ? "groq" : "local");
      }
    } catch (error) {
      if (thisRequest === requestId.current) {
        setReply(error instanceof Error ? error.message : "I couldn't connect to the conversation service. Please try again.");
      }
    } finally {
      if (thisRequest === requestId.current) setLoading(false);
    }
  };

  const say = (action: "greet" | "directions" | "city") => {
    const prompts = {
      greet: "Say hello to me and tell me what you're doing today.",
      directions: "Can you give me directions to useful places around this city?",
      city: "How is your day going? Tell me something interesting about life in this city.",
    };
    void sendMessage(prompts[action], action === "greet" ? "greet" : "talk");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || loading) return;
    setDraft("");
    void sendMessage(message);
  };

  return (
    <div style={{ position: "absolute", top: "34%", left: "50%", transform: "translateX(-50%)", width: "min(360px, calc(100% - 20px))", background: "rgba(18,27,34,.96)", color: "#fff", border: "1px solid rgba(255,255,255,.18)", borderRadius: 14, padding: 13, zIndex: 22, boxShadow: "0 8px 26px rgba(0,0,0,.3)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div><div style={{ fontWeight: 800 }}>{resident.name}</div><div style={{ fontSize: 11, opacity: 0.72, marginTop: 2 }}>{resident.role.replaceAll("_", " ")} · {resident.activity}</div></div>
        <button onClick={close} aria-label="Close conversation" style={{ background: "transparent", color: "white", border: 0, fontSize: 22 }}>×</button>
      </div>
      <div aria-live="polite" role="log" style={{ marginTop: 10, maxHeight: 150, overflowY: "auto", lineHeight: 1.4, fontSize: 12 }}>
        {history.map((turn, index) => <div key={`${index}-${turn.role}`} style={{ marginTop: 6, background: turn.role === "assistant" ? "rgba(255,255,255,.08)" : "rgba(72,145,198,.18)", padding: 8, borderRadius: 8 }}><b>{turn.role === "assistant" ? resident.name : "You"}:</b> {turn.content}</div>)}
        {loading && <div style={{ marginTop: 7, opacity: 0.85 }}> <span aria-hidden="true">● </span>{resident.name.split(" ")[0]} is thinking…</div>}
      </div>
      {reply && <div role="status" style={{ marginTop: 8, lineHeight: 1.4, fontSize: 12, background: "rgba(255,180,80,.12)", padding: 9, borderRadius: 9 }}>{reply}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        <button disabled={loading} onClick={() => say("greet")} style={dialogButton}>👋 Say hello</button>
        <button disabled={loading} onClick={() => say("directions")} style={dialogButton}>🗺️ Ask directions</button>
        <button disabled={loading} onClick={() => say("city")} style={dialogButton}>💬 Talk about the day</button>
      </div>
      <form onSubmit={submit} style={{ display: "flex", gap: 6, marginTop: 9 }}>
        <input aria-label="Message resident" value={draft} maxLength={500} onChange={(event) => setDraft(event.target.value)} placeholder="Say something…" disabled={loading} style={{ flex: 1, minWidth: 0, borderRadius: 8, padding: "9px 10px", border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.08)", color: "#fff", fontSize: 12 }} />
        <button disabled={loading || !draft.trim()} type="submit" style={{ ...dialogButton, opacity: loading || !draft.trim() ? 0.55 : 1 }}>Send</button>
      </form>
      <div style={{ fontSize: 10, opacity: 0.68, marginTop: 8 }}>{dialogueMode === "groq" ? "AI conversation powered by Groq." : dialogueMode === "local" ? "Local fallback reply. Add GROQ_API_KEY on the server for AI conversations." : "Responses are handled securely by the game server."}</div>
    </div>
  );
}
const dialogButton: CSSProperties = { border: "1px solid rgba(255,255,255,.16)", borderRadius: 8, padding: "7px 9px", background: "rgba(255,255,255,.09)", color: "#fff", fontSize: 11, cursor: "pointer" };

function CityActivityPill({ residents, vehicles, worldTime, weather }: { residents: number; vehicles: number; worldTime: number; weather: string }) {
  const hour = Math.floor(worldTime);
  const period = hour < 6 ? "Late night" : hour < 9 ? "Morning rush" : hour < 16 ? "Daytime" : hour < 19 ? "Evening rush" : hour < 22 ? "Evening" : "Night";
  const sky = weather === "sunny" ? "Clear" : weather.charAt(0).toUpperCase() + weather.slice(1);
  return <div style={{ position: "absolute", top: 285, left: 12, zIndex: 12, padding: "8px 11px", borderRadius: 11, background: "rgba(18,27,34,.83)", border: "1px solid rgba(255,255,255,.12)", color: "#fff", fontSize: 11, pointerEvents: "none", backdropFilter: "blur(8px)" }}>
    <div style={{ fontWeight: 750 }}>🏙️ {period}</div><div style={{ opacity: 0.78, marginTop: 3 }}>{residents} residents · {vehicles} vehicles · {sky}</div>
  </div>;
}

export function LivingCityScene() {
  const worldTime = useGameStore((s) => s.worldTime);
  const weather = useGameStore((s) => s.weather);
  const cityKey = useGameStore((s) => s.character?.cityKey || "lagos");
  const mobile = typeof window !== "undefined" && (window.innerWidth < 900 || "ontouchstart" in window);
  const residents = useMemo(() => mobile ? RESIDENTS.slice(0, 6) : RESIDENTS, [mobile]);
  const cars = useMemo(() => carConfigs(mobile), [mobile]);
  const night = worldTime < 6 || worldTime >= 19.5;
  const selectResident = (summary: ResidentSummary) => {
    window.dispatchEvent(new CustomEvent("life-sim:resident-selected", { detail: summary }));
  };

  return (
    <>
      {(weather === "rainy" || weather === "stormy") && <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.024, 0]}><planeGeometry args={[8.5, 700]} /><meshStandardMaterial color="#384c60" transparent opacity={0.28} roughness={0.28} metalness={0.16} depthWrite={false} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.024, 0]}><planeGeometry args={[700, 8.5]} /><meshStandardMaterial color="#384c60" transparent opacity={0.28} roughness={0.28} metalness={0.16} depthWrite={false} /></mesh>
      </group>}
      <TrafficLights worldTime={worldTime} />
      <BusStops />
      {cars.map((car) => <TrafficCar key={car.id} config={car} worldTime={worldTime} night={night} weather={weather} />)}
      {residents.map((resident) => <ResidentActor key={resident.id} resident={resident} worldTime={worldTime} weather={weather} cityKey={cityKey} onSelect={selectResident} />)}
      <WeatherEffects weather={weather} />
    </>
  );
}

export function LivingCityOverlay() {
  const worldTime = useGameStore((s) => s.worldTime);
  const weather = useGameStore((s) => s.weather);
  const isCity = useGameStore((s) => s.character?.location === "city");
  const mobile = typeof window !== "undefined" && (window.innerWidth < 900 || "ontouchstart" in window);
  const residentCount = mobile ? 6 : RESIDENTS.length;
  const vehicleCount = carConfigs(mobile).length;
  if (!isCity) return null;
  return <>
    <CityActivityPill residents={residentCount} vehicles={vehicleCount} worldTime={worldTime} weather={weather} />
    <ResidentInteractionPanel worldTime={worldTime} weather={weather} />
  </>;
}

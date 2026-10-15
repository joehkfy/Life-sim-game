import { Sky } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../stores/gameStore";

const TAU = Math.PI * 2;
const WORLD_EDGE = 330;
const COLOR_AMBIENT_NIGHT = new THREE.Color("#4a5f8a");
const COLOR_AMBIENT_DAY = new THREE.Color("#dce9ff");
const COLOR_HEMISPHERE_NIGHT = new THREE.Color("#3a4d78");
const COLOR_HEMISPHERE_DAY = new THREE.Color("#c6e0ff");
const COLOR_GROUND_NIGHT = new THREE.Color("#2a3548");
const COLOR_GROUND_DAY = new THREE.Color("#547044");
const COLOR_SUN_NIGHT = new THREE.Color("#a8bdf0");
const COLOR_SUN_DAY = new THREE.Color("#fff1d4");
const COLOR_SUNSET = new THREE.Color("#ff9a61");
const COLOR_CLOUDY = new THREE.Color("#a5b2c2");
const COLOR_FOG_DAY = new THREE.Color("#9ebfd4");
const COLOR_FOG_NIGHT = new THREE.Color("#1e2a45");

function solarDirection(time: number) {
  // 06:00 sunrise, 12:00 high sun, 18:00 sunset, midnight below the horizon.
  const angle = (time / 24) * TAU - Math.PI / 2;
  return new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0.18).normalize();
}

function daylightAt(time: number) {
  const elevation = solarDirection(time).y;
  return THREE.MathUtils.smoothstep(elevation, -0.12, 0.3);
}

function makeStarPositions(count: number, radius: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = Math.random() * 2 - 1;
    const angle = Math.random() * TAU;
    const ring = Math.sqrt(1 - y * y);
    positions[i * 3] = Math.cos(angle) * ring * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = Math.sin(angle) * ring * radius;
  }
  return positions;
}

function StarField() {
  const material = useRef<THREE.PointsMaterial>(null);
  const points = useRef<THREE.Points>(null);
  const { camera } = useThree();
  const positions = useMemo(() => makeStarPositions(850, 175), []);
  useFrame(() => {
    if (!material.current) return;
    if (points.current) points.current.position.copy(camera.position);
    const time = useGameStore.getState().worldTime;
    const sunHeight = solarDirection(time).y;
    // Stars fade softly through sunrise/sunset rather than appearing as a switch.
    material.current.opacity = 1 - THREE.MathUtils.smoothstep(sunHeight, -0.12, 0.12);
    material.current.size = time < 5.5 || time > 20 ? 1.55 : 1.05;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        color="#e6f1ff"
        size={1.2}
        sizeAttenuation={false}
        transparent
        opacity={0}
        depthWrite={false}
      />
    </points>
  );
}

function CelestialBodies() {
  const sun = useRef<THREE.Mesh>(null);
  const moon = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    const time = useGameStore.getState().worldTime;
    const direction = solarDirection(time);
    if (sun.current) {
      sun.current.position.copy(camera.position).addScaledVector(direction, 115);
      sun.current.visible = direction.y > -0.08;
    }
    if (moon.current) {
      moon.current.position.copy(camera.position).addScaledVector(direction, -108);
      moon.current.visible = direction.y < 0.18;
      moon.current.rotation.y += 0.0008;
    }
  });

  return (
    <>
      <mesh ref={sun} frustumCulled={false}>
        <sphereGeometry args={[2.2, 20, 16]} />
        <meshBasicMaterial color="#fff4c4" toneMapped={false} />
      </mesh>
      <group ref={moon} frustumCulled={false}>
        <mesh>
          <sphereGeometry args={[1.65, 20, 16]} />
          <meshStandardMaterial color="#d9e2f2" emissive="#7a91b7" emissiveIntensity={0.38} roughness={0.92} />
        </mesh>
        <mesh position={[0.55, 0.35, 1.43]} scale={[0.25, 0.18, 0.035]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color="#aebcd0" />
        </mesh>
        <mesh position={[-0.52, -0.5, 1.38]} scale={[0.18, 0.15, 0.035]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color="#aebcd0" />
        </mesh>
      </group>
    </>
  );
}

function Cloud({ index, count, mobile, weather }: { index: number; count: number; mobile: boolean; weather: string }) {
  const group = useRef<THREE.Group>(null);
  const baseZ = ((index * 29) % 150) - 75;
  const baseY = 28 + ((index * 11) % 15);
  const speed = 0.9 + (index % 4) * 0.28;
  const grey = weather === "rainy" || weather === "stormy" || weather === "cloudy";
  const cloudColor = grey ? (weather === "stormy" ? "#687482" : "#aeb9c5") : "#ffffff";

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.position.x += speed * Math.min(delta, 0.05);
    if (group.current.position.x > WORLD_EDGE) group.current.position.x = -WORLD_EDGE;
  });

  const puffSize = mobile ? 0.82 : 1;
  const initialX = -WORLD_EDGE + (index / Math.max(1, count - 1)) * WORLD_EDGE * 2;
  return (
    <group ref={group} position={[initialX, baseY, baseZ]} scale={puffSize}>
      <mesh position={[-2.4, 0, 0]} scale={[1.15, 0.47, 0.74]}>
        <sphereGeometry args={[2.5, 8, 6]} />
        <meshStandardMaterial color={cloudColor} roughness={1} transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.55, 0]} scale={[1.35, 0.63, 0.9]}>
        <sphereGeometry args={[2.6, 8, 6]} />
        <meshStandardMaterial color={cloudColor} roughness={1} transparent opacity={0.76} depthWrite={false} />
      </mesh>
      <mesh position={[2.4, 0.05, 0]} scale={[1.05, 0.45, 0.72]}>
        <sphereGeometry args={[2.4, 8, 6]} />
        <meshStandardMaterial color={cloudColor} roughness={1} transparent opacity={0.68} depthWrite={false} />
      </mesh>
    </group>
  );
}

function CloudLayer() {
  const weather = useGameStore((s) => s.weather);
  const mobile = typeof window !== "undefined" && (window.innerWidth < 900 || "ontouchstart" in window);
  const count = mobile ? 8 : 14;
  // Let the cloud tint follow the weather and the world get darker toward night.
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <Cloud key={i} index={i} count={count} mobile={mobile} weather={weather} />
      ))}
    </group>
  );
}

function Bird({ index, count }: { index: number; count: number }) {
  const group = useRef<THREE.Group>(null);
  const leftWing = useRef<THREE.Mesh>(null);
  const rightWing = useRef<THREE.Mesh>(null);
  const phase = index * 1.7;
  const initialX = -WORLD_EDGE + (index / Math.max(1, count - 1)) * WORLD_EDGE * 2;
  const initialY = 12 + (index % 3) * 3.5;
  const initialZ = -48 + ((index * 23) % 96);
  const speed = 5.2 + (index % 4) * 1.2;

  useFrame((state, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 0.05);
    group.current.position.x += speed * dt;
    group.current.position.z += Math.sin(state.clock.elapsedTime * 0.6 + phase) * 0.025;
    group.current.position.y = initialY + Math.sin(state.clock.elapsedTime * 1.3 + phase) * 0.55;
    if (group.current.position.x > WORLD_EDGE) {
      group.current.position.x = -WORLD_EDGE;
      group.current.position.z = initialZ;
    }
    const flap = Math.sin(state.clock.elapsedTime * 10 + phase) * 0.52;
    if (leftWing.current) leftWing.current.rotation.x = flap;
    if (rightWing.current) rightWing.current.rotation.x = -flap;
  });

  return (
    <group ref={group} position={[initialX, initialY, initialZ]}>
      <mesh scale={[0.12, 0.08, 0.28]}>
        <sphereGeometry args={[1, 7, 5]} />
        <meshBasicMaterial color="#202c35" />
      </mesh>
      <mesh position={[0, 0.02, 0.04]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.07, 0.2, 5]} />
        <meshBasicMaterial color="#273746" />
      </mesh>
      <mesh ref={leftWing} position={[0, 0.02, -0.12]}>
        <boxGeometry args={[0.045, 0.045, 0.52]} />
        <meshBasicMaterial color="#202c35" />
      </mesh>
      <mesh ref={rightWing} position={[0, 0.02, 0.12]}>
        <boxGeometry args={[0.045, 0.045, 0.52]} />
        <meshBasicMaterial color="#202c35" />
      </mesh>
    </group>
  );
}

function BirdFlocks() {
  const worldTime = useGameStore((s) => s.worldTime);
  const mobile = typeof window !== "undefined" && (window.innerWidth < 900 || "ontouchstart" in window);
  const daytime = worldTime >= 5.5 && worldTime < 19.5;
  if (!daytime) return null;
  const count = mobile ? 5 : 10;
  return <group>{Array.from({ length: count }, (_, i) => <Bird key={i} index={i} count={count} />)}</group>;
}

export function Environment() {
  const worldTime = useGameStore((s) => s.worldTime);
  const weather = useGameStore((s) => s.weather);
  const { scene } = useThree();
  const ambient = useRef<THREE.AmbientLight>(null);
  const hemisphere = useRef<THREE.HemisphereLight>(null);
  const sunLight = useRef<THREE.DirectionalLight>(null);
  const skySunPosition = useMemo(() => solarDirection(worldTime).multiplyScalar(100), [worldTime]);
  const skyTurbidity = weather === "stormy" ? 15 : weather === "cloudy" || weather === "rainy" ? 9 : 4.5;

  useFrame(() => {
    const time = useGameStore.getState().worldTime;
    const direction = solarDirection(time);
    const daylight = daylightAt(time);
    const twilight = THREE.MathUtils.clamp(1 - Math.abs(direction.y) / 0.3, 0, 1) * (direction.y < 0.15 ? 1 : 0);

    // Keep a readable floor at night (phones go near-black with 0.12 ambient).
    if (ambient.current) {
      ambient.current.intensity = 0.38 + daylight * 0.35;
      ambient.current.color.copy(COLOR_AMBIENT_NIGHT).lerp(COLOR_AMBIENT_DAY, daylight);
    }
    if (hemisphere.current) {
      hemisphere.current.intensity = 0.32 + daylight * 0.4;
      hemisphere.current.color.copy(COLOR_HEMISPHERE_NIGHT).lerp(COLOR_HEMISPHERE_DAY, daylight);
      hemisphere.current.groundColor.copy(COLOR_GROUND_NIGHT).lerp(COLOR_GROUND_DAY, daylight);
    }
    if (sunLight.current) {
      // At night this acts as soft moonlight instead of a dead light.
      const moonFill = 1 - daylight;
      sunLight.current.position.set(direction.x * 100, Math.max(direction.y, 0.15) * 100, direction.z * 100);
      sunLight.current.intensity = 0.22 * moonFill + daylight * 1.65 + twilight * 0.22;
      const base = COLOR_SUN_NIGHT.clone().lerp(COLOR_SUN_DAY, daylight);
      base.lerp(COLOR_SUNSET, twilight * 0.68);
      if (weather === "cloudy" || weather === "rainy" || weather === "stormy") {
        base.lerp(COLOR_CLOUDY, weather === "stormy" ? 0.7 : 0.35);
        sunLight.current.intensity *= weather === "stormy" ? 0.55 : weather === "rainy" ? 0.72 : 0.85;
      }
      sunLight.current.color.copy(base);
      sunLight.current.target.position.set(0, 0, 0);
      sunLight.current.target.updateMatrixWorld();
    }

    const fog = scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.color.copy(COLOR_FOG_NIGHT).lerp(COLOR_FOG_DAY, daylight);
      // Less aggressive fog at night so the city does not disappear into black.
      fog.near = 50 + daylight * 20;
      fog.far = 220 + daylight * 80;
    }
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.5} />
      <hemisphereLight ref={hemisphere} intensity={0.55} color="#c5e0ff" groundColor="#3d5c3a" />
      <directionalLight
        ref={sunLight}
        position={[40, 60, 25]}
        intensity={1.45}
        castShadow
        shadow-mapSize={[mobileShadowSize(), mobileShadowSize()]}
        shadow-camera-far={180}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.0002}
      />
      <Sky sunPosition={skySunPosition} turbidity={skyTurbidity} rayleigh={1.2} mieCoefficient={0.004} />
      <fog attach="fog" args={["#9ebfd4", 70, 300]} />
      <CelestialBodies />
      <StarField />
      <CloudLayer />
      <BirdFlocks />
    </>
  );
}

function mobileShadowSize() {
  if (typeof window === "undefined") return 1024;
  return window.innerWidth < 900 || "ontouchstart" in window ? 1024 : 2048;
}

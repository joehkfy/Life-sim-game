import { Component, Suspense, useMemo, useRef, type ReactNode } from "react";
import { RiggedAvatar } from "./RiggedAvatar";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CharacterAppearance } from "@life-sim/shared";

/**
 * Stylized, semi-realistic avatar with a procedural character rig.
 * The proportions and face are anime/Donghua-inspired without going full chibi.
 * Meshes are attached to joint pivots so movement and interaction poses animate
 * on low-end devices without loading a large external animation runtime.
 */
function ProceduralAvatar({
  appearance,
  shirtColor = "#3b82f6",
  pantsColor = "#1e293b",
  showFace = true,
  animation = "idle",
}: {
  appearance: CharacterAppearance;
  shirtColor?: string;
  pantsColor?: string;
  showFace?: boolean;
  animation?: string;
}) {
  const rig = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const pelvis = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyeL = useRef<THREE.Group>(null);
  const eyeR = useRef<THREE.Group>(null);
  const browL = useRef<THREE.Group>(null);
  const browR = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Group>(null);
  const upperArmL = useRef<THREE.Group>(null);
  const upperArmR = useRef<THREE.Group>(null);
  const forearmL = useRef<THREE.Group>(null);
  const forearmR = useRef<THREE.Group>(null);
  const thighL = useRef<THREE.Group>(null);
  const thighR = useRef<THREE.Group>(null);
  const shinL = useRef<THREE.Group>(null);
  const shinR = useRef<THREE.Group>(null);
  const handL = useRef<THREE.Group>(null);
  const handR = useRef<THREE.Group>(null);
  const book = useRef<THREE.Group>(null);
  const propFood = useRef<THREE.Group>(null);
  const animationStart = useRef(0);
  const lastAnimation = useRef(animation);
  const previousAnimation = useRef(animation);
  const nextBlinkAt = useRef(2.4 + Math.random() * 2.2);

  const skin = useMemo(() => {
    const tone = THREE.MathUtils.clamp(appearance?.skinTone ?? 0.55, 0, 1);
    return new THREE.Color().setHSL(0.065, 0.42, 0.27 + tone * 0.48);
  }, [appearance?.skinTone]);
  const hair = appearance?.hairColor || "#2c1810";
  const style = Math.abs(Math.floor(appearance?.hairStyle ?? 0)) % 4;
  const eyeColors = ["#7b5135", "#263f75", "#28735e", "#83539d"];
  const facePreset = Math.abs(Math.floor(appearance?.facePreset ?? 0)) % eyeColors.length;
  const eyeColor = eyeColors[facePreset];
  const profile = useMemo(() => [
    new THREE.Vector2(0, 0), new THREE.Vector2(0.20, 0.02),
    new THREE.Vector2(0.235, 0.12), new THREE.Vector2(0.235, 0.30),
    new THREE.Vector2(0.29, 0.49), new THREE.Vector2(0.275, 0.66),
    new THREE.Vector2(0.19, 0.76), new THREE.Vector2(0.105, 0.82),
    new THREE.Vector2(0, 0.82),
  ], []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const now = state.clock.elapsedTime;
    if (lastAnimation.current !== animation) {
      previousAnimation.current = lastAnimation.current;
      lastAnimation.current = animation;
      animationStart.current = now;
    }
    const elapsed = now - animationStart.current;
    const previous = previousAnimation.current;
    const standUpSource = animation === "stand_up" && ["relax", "sit", "watch_tv_sit", "work_on_computer"].includes(previous);
    const standUpProgress = standUpSource ? THREE.MathUtils.smoothstep(elapsed, 0, 0.82) : 1;
    const walk = animation === "walk";
    const run = animation === "run";
    const moving = walk || run;
    const seated = animation === "relax" || animation === "sit" || animation === "watch_tv_sit" || animation === "work_on_computer";
    const sleeping = animation === "sleep" || animation === "waking";
    const cooking = animation === "cook";
    const showering = animation === "shower";
    const eating = animation === "get_snack";
    const reading = animation === "read";
    const typing = animation === "work_on_computer";
    const relaxing = animation === "relax" || animation === "watch_tv_sit";

    const strideRate = run ? 11.2 : 7.4;
    const stride = Math.sin(now * strideRate);
    const bendL = Math.max(0, -stride) * (run ? 0.72 : 0.48);
    const bendR = Math.max(0, stride) * (run ? 0.72 : 0.48);
    let hipLX = moving ? stride * (run ? 0.72 : 0.48) : 0;
    let hipRX = moving ? -stride * (run ? 0.72 : 0.48) : 0;
    let kneeLX = moving ? bendL : 0.025;
    let kneeRX = moving ? bendR : 0.025;
    let armLX = moving ? -stride * (run ? 0.62 : 0.38) : 0;
    let armRX = moving ? stride * (run ? 0.62 : 0.38) : 0;
    let elbowLX = moving ? Math.max(0, stride) * (run ? 0.42 : 0.18) : 0.04;
    let elbowRX = moving ? Math.max(0, -stride) * (run ? 0.42 : 0.18) : 0.04;
    let shoulderLZ = -0.10;
    let shoulderRZ = 0.10;
    let torsoX = run ? 0.13 : walk ? 0.055 : Math.sin(now * 1.3) * 0.012;
    let torsoZ = moving ? Math.sin(now * strideRate * 0.5) * 0.035 : Math.sin(now * 0.8) * 0.009;
    let headX = moving ? -torsoX * 0.34 : Math.sin(now * 1.1) * 0.012;
    let headY = Math.sin(now * 0.65) * 0.018;
    let headZ = Math.sin(now * 0.9) * 0.01;
    let headPoseY = 1.83;
    let headTranslateZ = 0;
    let rigY = 0;
    let rigZ = 0;
    let rigTranslateX = 0;
    let rigX = 0;
    let torsoBob = moving ? Math.abs(Math.sin(now * strideRate)) * (run ? 0.045 : 0.022) : Math.sin(now * 1.7) * 0.008;
    let torsoBreathZ = 0;
    let showBook = false;
    let showFood = false;

    if (seated) {
      hipLX = -1.24;
      hipRX = -1.24;
      kneeLX = 1.22;
      kneeRX = 1.22;
      rigY = 0;
      // Seat alignment is handled by the player controller; do not offset the
      // whole rig again here or the avatar visibly slides away from furniture.
      rigZ = 0;
      rigTranslateX = 0;
      torsoX = relaxing ? -0.065 : typing ? 0.035 : 0.015;
      torsoZ = relaxing ? Math.sin(now * 0.65) * 0.015 : 0;
      armLX = typing ? -0.66 : reading ? -0.50 : relaxing ? -0.24 : -0.18;
      armRX = typing ? -0.66 : reading ? -0.50 : relaxing ? -0.24 : -0.18;
      elbowLX = typing ? -0.72 : reading ? -0.82 : -0.32;
      elbowRX = typing ? -0.72 : reading ? -0.82 : -0.32;
      shoulderLZ = -0.16;
      shoulderRZ = 0.16;
      headX = typing ? -0.08 : reading ? -0.11 : 0.015;
      headY = typing ? Math.sin(now * 1.4) * 0.025 : Math.sin(now * 0.55) * 0.012;
      if (typing) {
        armLX += Math.sin(now * 10.5) * 0.035;
        armRX += Math.sin(now * 10.5 + 1.2) * 0.035;
        elbowLX -= Math.abs(Math.sin(now * 10.5)) * 0.06;
        elbowRX -= Math.abs(Math.sin(now * 10.5 + 1.2)) * 0.06;
      }
    }

    if (reading) {
      torsoX = -0.045;
      armLX = -0.52;
      armRX = -0.52;
      elbowLX = -0.78;
      elbowRX = -0.78;
      shoulderLZ = -0.14;
      shoulderRZ = 0.14;
      headX = -0.11 + Math.sin(now * 1.2) * 0.015;
      showBook = true;
    }

    if (animation === "watch_tv") {
      // Fallback pose for houses without a sofa: stand naturally and watch the screen.
      torsoX = -0.015 + Math.sin(now * 0.8) * 0.012;
      headX = -0.055;
      headY = Math.sin(now * 0.5) * 0.025;
      armLX = -0.06;
      armRX = -0.06;
      elbowLX = 0.12;
      elbowRX = 0.12;
    }

    if (animation === "watch_tv_sit") {
      torsoX = -0.045 + Math.sin(now * 0.8) * 0.012;
      torsoZ = Math.sin(now * 0.65) * 0.012;
      headX = -0.035;
      headY = Math.sin(now * 0.55) * 0.018;
      armLX = -0.22;
      armRX = -0.20;
      elbowLX = -0.30;
      elbowRX = -0.28;
    }

    if (cooking) {
      torsoX = 0.045;
      armLX = -0.58 - Math.sin(now * 3.4) * 0.12;
      armRX = -0.42 - Math.sin(now * 3.4 + 1.4) * 0.18;
      elbowLX = -0.64 - Math.max(0, Math.sin(now * 3.4)) * 0.2;
      elbowRX = -0.72 - Math.max(0, Math.sin(now * 3.4 + 1.4)) * 0.2;
      shoulderLZ = -0.12;
      shoulderRZ = 0.12;
      headX = 0.05 + Math.sin(now * 1.7) * 0.025;
    }

    if (showering) {
      torsoX = 0.025;
      armLX = -0.65 - Math.sin(now * 2.6) * 0.10;
      armRX = -0.36 - Math.sin(now * 2.2 + 1) * 0.09;
      elbowLX = -0.95 - Math.sin(now * 2.6) * 0.12;
      elbowRX = -0.80 - Math.sin(now * 2.2 + 1) * 0.1;
      shoulderLZ = -0.22;
      shoulderRZ = 0.2;
      headX = -0.10;
    }

    if (eating) {
      const reach = Math.max(0, Math.sin(now * 3.1));
      armRX = -0.55 - reach * 0.56;
      elbowRX = -0.55 - reach * 0.55;
      shoulderRZ = 0.16;
      armLX = -0.14;
      elbowLX = -0.12;
      headX = -0.045 - reach * 0.06;
      showFood = true;
    }

    if (sleeping) {
      const wake = animation === "waking";
      // On wake, first lift the torso and head while the legs remain on the bed,
      // then smoothly bring the hips/legs upright. This reads as sitting up,
      // rather than the whole body snapping from horizontal to vertical.
      const rise = wake ? THREE.MathUtils.smoothstep(elapsed, 0, 0.42) : 0;
      const blend = wake
        ? 1 - THREE.MathUtils.smoothstep(elapsed, 0.42, 1.05)
        : THREE.MathUtils.smoothstep(elapsed, 0, 1.12);
      // Rotate around hip height, lowering the horizontal body to mattress height.
      rigX = -Math.PI * 0.5 * blend;
      rigY = -0.16 * blend;
      rigZ = 0;
      rigTranslateX = 0;
      hipLX = Math.sin(now * 1.4) * 0.012 * blend;
      hipRX = -Math.sin(now * 1.4) * 0.012 * blend;
      kneeLX = THREE.MathUtils.lerp(kneeLX, 0.01, blend);
      kneeRX = THREE.MathUtils.lerp(kneeRX, 0.01, blend);
      armLX = -0.06 * blend;
      armRX = -0.06 * blend;
      elbowLX = THREE.MathUtils.lerp(elbowLX, 0.06, blend);
      elbowRX = THREE.MathUtils.lerp(elbowRX, 0.06, blend);
      shoulderLZ = THREE.MathUtils.lerp(-0.10, -0.28, blend);
      shoulderRZ = THREE.MathUtils.lerp(0.10, 0.28, blend);
      torsoX = wake ? Math.PI * 0.5 * rise * blend : Math.sin(now * 1.3) * 0.012;
      headX = wake ? Math.PI * 0.5 * rise * blend : Math.sin(now * 1.3 + 0.4) * 0.01;
      headY = 0;
      if (wake && elapsed < 0.42) {
        headPoseY = THREE.MathUtils.lerp(1.83, 0.80, rise);
        headTranslateZ = 1.03 * rise;
      } else if (wake) {
        headPoseY = 0.80 + 1.03 * (1 - blend);
        headTranslateZ = 1.03 * blend;
      }
      showBook = false;
      showFood = false;
      // Because the body is lying down, local Z maps to world height. This makes
      // the chest rise/fall gently instead of sliding the whole torso along the bed.
      torsoBreathZ = Math.sin(now * 1.3) * 0.015 * blend;
      torsoBob = 0;
    }

    // Blend a seated pose back into a relaxed standing pose instead of popping
    // every joint to its idle target at the end of an interaction.
    if (standUpSource) {
      const seatedArmL = previous === "work_on_computer" ? -0.66 : -0.24;
      const seatedArmR = previous === "work_on_computer" ? -0.66 : -0.24;
      const seatedElbowL = previous === "work_on_computer" ? -0.72 : -0.32;
      const seatedElbowR = previous === "work_on_computer" ? -0.72 : -0.32;
      const k = standUpProgress;
      hipLX = THREE.MathUtils.lerp(-1.24, hipLX, k);
      hipRX = THREE.MathUtils.lerp(-1.24, hipRX, k);
      kneeLX = THREE.MathUtils.lerp(1.22, kneeLX, k);
      kneeRX = THREE.MathUtils.lerp(1.22, kneeRX, k);
      armLX = THREE.MathUtils.lerp(seatedArmL, armLX, k);
      armRX = THREE.MathUtils.lerp(seatedArmR, armRX, k);
      elbowLX = THREE.MathUtils.lerp(seatedElbowL, elbowLX, k);
      elbowRX = THREE.MathUtils.lerp(seatedElbowR, elbowRX, k);
      torsoX = THREE.MathUtils.lerp(-0.045, torsoX, k);
      headX = THREE.MathUtils.lerp(-0.02, headX, k);
    }

    // Exponential damping remains stable across high and low frame rates.
    const blend = 1 - Math.exp(-12 * dt);
    const damp = (object: THREE.Object3D | null, axis: "x" | "y" | "z", value: number) => {
      if (object) object.rotation[axis] = THREE.MathUtils.lerp(object.rotation[axis], value, blend);
    };
    const dampPosition = (object: THREE.Object3D | null, axis: "x" | "y" | "z", value: number) => {
      if (object) object.position[axis] = THREE.MathUtils.lerp(object.position[axis], value, blend);
    };

    if (rig.current) {
      damp(rig.current, "x", rigX);
      dampPosition(rig.current, "x", rigTranslateX);
      dampPosition(rig.current, "y", 0.8 + rigY);
      dampPosition(rig.current, "z", rigZ);
    }
    const pelvisTargetY = standUpSource ? THREE.MathUtils.lerp(0.62, 0.80, standUpProgress) : seated ? 0.62 : 0.80;
    const torsoTargetY = standUpSource ? THREE.MathUtils.lerp(0.58, 0.78, standUpProgress) : seated ? 0.58 : 0.78;
    const headTargetY = sleeping ? headPoseY : standUpSource ? THREE.MathUtils.lerp(1.63, 1.83, standUpProgress) : seated ? 1.63 : 1.83;
    const headTargetZ = sleeping ? headTranslateZ : 0;
    if (pelvis.current) dampPosition(pelvis.current, "y", pelvisTargetY);
    if (torso.current) {
      damp(torso.current, "x", torsoX);
      damp(torso.current, "z", torsoZ);
      dampPosition(torso.current, "z", torsoBreathZ);
      dampPosition(torso.current, "y", torsoTargetY + torsoBob);
    }
    if (head.current) {
      dampPosition(head.current, "y", headTargetY);
      dampPosition(head.current, "z", headTargetZ);
      damp(head.current, "x", headX);
      damp(head.current, "y", headY);
      damp(head.current, "z", headZ);
    }

    // Blinks are slightly irregular rather than ticking on a fixed loop. Closed
    // eyes remain closed for sleep; action-specific expressions stay subtle.
    if (now > nextBlinkAt.current + 0.20) nextBlinkAt.current = now + 2.4 + Math.random() * 3.8;
    const blinkProgress = (now >= nextBlinkAt.current && now <= nextBlinkAt.current + 0.20)
      ? (now - nextBlinkAt.current) / 0.20 : -1;
    const blinkAmount = blinkProgress >= 0 ? Math.sin(Math.PI * blinkProgress) : 0;
    const eyesStillClosed = animation === "sleep" || (animation === "waking" && elapsed < 0.38);
    const eyeBase = eyesStillClosed ? 0.045 : relaxing ? 0.88 : run ? 1.04 : 1;
    const blinkScale = eyesStillClosed ? 0.045 : eyeBase * (1 - blinkAmount * 0.94);
    const gazeDown = cooking || reading ? -0.008 : typing ? -0.004 : eating ? -0.003 : 0;
    const gazeSide = animation === "watch_tv_sit" ? Math.sin(now * 0.28) * 0.004 : 0;
    if (eyeL.current) {
      eyeL.current.scale.y = THREE.MathUtils.damp(eyeL.current.scale.y, blinkScale, 26, dt);
      dampPosition(eyeL.current, "x", -0.082 + gazeSide);
      dampPosition(eyeL.current, "y", 0.012 + gazeDown);
    }
    if (eyeR.current) {
      eyeR.current.scale.y = THREE.MathUtils.damp(eyeR.current.scale.y, blinkScale, 26, dt);
      dampPosition(eyeR.current, "x", 0.082 + gazeSide);
      dampPosition(eyeR.current, "y", 0.012 + gazeDown);
    }

    const browTilt = sleeping ? 0.02 : cooking ? 0.045 : (animation === "waking" || animation === "stand_up") ? -0.025 : run ? -0.035 : 0;
    if (browL.current) browL.current.rotation.z = THREE.MathUtils.damp(browL.current.rotation.z, browTilt, 10, dt);
    if (browR.current) browR.current.rotation.z = THREE.MathUtils.damp(browR.current.rotation.z, -browTilt, 10, dt);
    if (mouth.current) {
      const mouthX = eating ? 1.0 + Math.max(0, Math.sin(now * 3.1)) * 0.25 : relaxing ? 1.08 : 1;
      const mouthY = animation === "sleep" || (animation === "waking" && elapsed < 0.38)
        ? 0.45 : eating ? 1.35 + Math.max(0, Math.sin(now * 3.1)) * 0.55 : 1;
      mouth.current.scale.x = THREE.MathUtils.damp(mouth.current.scale.x, mouthX, 12, dt);
      mouth.current.scale.y = THREE.MathUtils.damp(mouth.current.scale.y, mouthY, 14, dt);
    }
    if (upperArmL.current) {
      damp(upperArmL.current, "x", armLX);
      damp(upperArmL.current, "z", shoulderLZ);
    }
    if (upperArmR.current) {
      damp(upperArmR.current, "x", armRX);
      damp(upperArmR.current, "z", shoulderRZ);
    }
    if (forearmL.current) damp(forearmL.current, "x", elbowLX);
    if (forearmR.current) damp(forearmR.current, "x", elbowRX);
    if (thighL.current) damp(thighL.current, "x", hipLX);
    if (thighR.current) damp(thighR.current, "x", hipRX);
    if (shinL.current) damp(shinL.current, "x", kneeLX);
    if (shinR.current) damp(shinR.current, "x", kneeRX);
    if (handL.current) damp(handL.current, "x", typing ? Math.sin(now * 10.5) * 0.06 : reading ? Math.sin(now * 1.3) * 0.03 : 0);
    if (handR.current) damp(handR.current, "x", typing ? Math.sin(now * 10.5 + 1.2) * 0.06 : eating ? Math.sin(now * 3.1) * 0.08 : 0);
    if (book.current) book.current.visible = showBook;
    if (propFood.current) propFood.current.visible = showFood;
  });

  return (
    <group>
      <group ref={rig} position={[0, 0.8, 0]}>
        <group position={[0, -0.8, 0]}>
        {/* Lower body / pelvis */}
        <group ref={pelvis} position={[0, 0.80, 0]}>
          <mesh castShadow>
            <capsuleGeometry args={[0.225, 0.18, 5, 12]} />
            <meshStandardMaterial color={pantsColor} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.07, 0.012]} castShadow>
            <boxGeometry args={[0.40, 0.065, 0.32]} />
            <meshStandardMaterial color="#39414a" roughness={0.68} metalness={0.12} />
          </mesh>
          <mesh position={[0, 0.07, 0.18]}>
            <boxGeometry args={[0.06, 0.065, 0.018]} />
            <meshStandardMaterial color="#d6b46a" metalness={0.55} roughness={0.35} />
          </mesh>
        </group>

        {/* Articulated legs. The upper and lower segments pivot at realistic joints. */}
        <group ref={thighL} position={[-0.145, 0.90, 0]}>
          <mesh position={[0, -0.245, 0]} castShadow>
            <capsuleGeometry args={[0.115, 0.30, 5, 12]} />
            <meshStandardMaterial color={pantsColor} roughness={0.82} />
          </mesh>
          <mesh position={[0, -0.10, 0.012]} castShadow>
            <boxGeometry args={[0.205, 0.055, 0.22]} />
            <meshStandardMaterial color={pantsColor} roughness={0.8} />
          </mesh>
          <group ref={shinL} position={[0, -0.48, 0]}>
            <mesh position={[0, -0.205, 0]} castShadow>
              <capsuleGeometry args={[0.085, 0.26, 5, 10]} />
              <meshStandardMaterial color={pantsColor} roughness={0.78} />
            </mesh>
            <mesh position={[0, -0.34, 0.055]} castShadow>
              <group>
                <mesh position={[0, 0.015, 0]} castShadow>
                  <boxGeometry args={[0.20, 0.13, 0.33]} />
                  <meshStandardMaterial color="#191e27" roughness={0.45} />
                </mesh>
                <mesh position={[0, -0.055, 0.045]}>
                  <boxGeometry args={[0.205, 0.035, 0.30]} />
                  <meshStandardMaterial color="#e9e8e2" roughness={0.75} />
                </mesh>
              </group>
            </mesh>
          </group>
        </group>

        <group ref={thighR} position={[0.145, 0.90, 0]}>
          <mesh position={[0, -0.245, 0]} castShadow>
            <capsuleGeometry args={[0.115, 0.30, 5, 12]} />
            <meshStandardMaterial color={pantsColor} roughness={0.82} />
          </mesh>
          <mesh position={[0, -0.10, 0.012]} castShadow>
            <boxGeometry args={[0.205, 0.055, 0.22]} />
            <meshStandardMaterial color={pantsColor} roughness={0.8} />
          </mesh>
          <group ref={shinR} position={[0, -0.48, 0]}>
            <mesh position={[0, -0.205, 0]} castShadow>
              <capsuleGeometry args={[0.085, 0.26, 5, 10]} />
              <meshStandardMaterial color={pantsColor} roughness={0.78} />
            </mesh>
            <mesh position={[0, -0.34, 0.055]} castShadow>
              <mesh position={[0, 0.015, 0]} castShadow>
                <boxGeometry args={[0.20, 0.13, 0.33]} />
                <meshStandardMaterial color="#191e27" roughness={0.45} />
              </mesh>
              <mesh position={[0, -0.055, 0.045]}>
                <boxGeometry args={[0.205, 0.035, 0.30]} />
                <meshStandardMaterial color="#e9e8e2" roughness={0.75} />
              </mesh>
            </mesh>
          </group>
        </group>

        {/* Tailored torso: tapered lathe silhouette under the shirt, with seam details. */}
        <group ref={torso} position={[0, 0.78, 0]}>
          <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
            <latheGeometry args={[profile, 18]} />
            <meshStandardMaterial color={shirtColor} roughness={0.72} />
          </mesh>
          <mesh position={[0, 0.23, 0.215]}>
            <boxGeometry args={[0.30, 0.02, 0.012]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.18} roughness={0.7} />
          </mesh>
          {/* Collar and layered inner shirt */}
          <mesh position={[0, 0.78, 0.015]} rotation={[0.12, 0, 0]} castShadow>
            <boxGeometry args={[0.23, 0.095, 0.18]} />
            <meshStandardMaterial color="#f4f0e8" roughness={0.75} />
          </mesh>
          <mesh position={[0, 0.63, 0.22]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.075, 0.22, 0.025]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.7} />
          </mesh>
          {/* Shoulder seams and subtle jacket trim */}
          <mesh position={[-0.205, 0.60, 0.03]} rotation={[0, 0, -0.23]}>
            <boxGeometry args={[0.025, 0.35, 0.025]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.24} roughness={0.8} />
          </mesh>
          <mesh position={[0.205, 0.60, 0.03]} rotation={[0, 0, 0.23]}>
            <boxGeometry args={[0.025, 0.35, 0.025]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.24} roughness={0.8} />
          </mesh>

          {/* Neck */}
          <mesh position={[0, 0.83, 0]} castShadow>
            <cylinderGeometry args={[0.085, 0.105, 0.18, 12]} />
            <meshStandardMaterial color={skin} roughness={0.68} />
          </mesh>

          {/* Neckline shadow and a small throat highlight */}
          <mesh position={[0, 0.76, 0.075]}>
            <boxGeometry args={[0.11, 0.025, 0.02]} />
            <meshStandardMaterial color="#bfc8d5" roughness={0.7} />
          </mesh>

          {/* Arms */}
          <group ref={upperArmL} position={[-0.305, 0.63, 0]} rotation={[0, 0, -0.10]}>
            <mesh position={[0, -0.205, 0]} castShadow>
              <capsuleGeometry args={[0.085, 0.27, 5, 12]} />
              <meshStandardMaterial color={shirtColor} roughness={0.73} />
            </mesh>
            <mesh position={[0, -0.09, 0.012]} rotation={[0, 0, -0.03]}>
              <boxGeometry args={[0.15, 0.07, 0.17]} />
              <meshStandardMaterial color={shirtColor} roughness={0.75} />
            </mesh>
            <group ref={forearmL} position={[0, -0.41, 0]}>
              <mesh position={[0, -0.18, 0]} castShadow>
                <capsuleGeometry args={[0.067, 0.24, 5, 10]} />
                <meshStandardMaterial color={shirtColor} roughness={0.76} />
              </mesh>
              <mesh position={[0, -0.295, 0.015]} castShadow>
                <capsuleGeometry args={[0.06, 0.10, 4, 8]} />
                <meshStandardMaterial color={skin} roughness={0.67} />
              </mesh>
              <group ref={handL} position={[0, -0.34, 0.035]}>
                <mesh castShadow>
                  <sphereGeometry args={[0.075, 12, 10]} />
                  <meshStandardMaterial color={skin} roughness={0.62} />
                </mesh>
                <mesh position={[-0.04, -0.04, 0.018]} rotation={[0.3, 0, -0.1]}>
                  <capsuleGeometry args={[0.018, 0.055, 3, 6]} />
                  <meshStandardMaterial color={skin} roughness={0.64} />
                </mesh>
                <mesh position={[0.0, -0.05, 0.022]}>
                  <capsuleGeometry args={[0.018, 0.06, 3, 6]} />
                  <meshStandardMaterial color={skin} roughness={0.64} />
                </mesh>
                <mesh position={[0.04, -0.04, 0.015]} rotation={[0.2, 0, 0.1]}>
                  <capsuleGeometry args={[0.017, 0.05, 3, 6]} />
                  <meshStandardMaterial color={skin} roughness={0.64} />
                </mesh>
              </group>
            </group>
          </group>

          <group ref={upperArmR} position={[0.305, 0.63, 0]} rotation={[0, 0, 0.10]}>
            <mesh position={[0, -0.205, 0]} castShadow>
              <capsuleGeometry args={[0.085, 0.27, 5, 12]} />
              <meshStandardMaterial color={shirtColor} roughness={0.73} />
            </mesh>
            <mesh position={[0, -0.09, 0.012]} rotation={[0, 0, 0.03]}>
              <boxGeometry args={[0.15, 0.07, 0.17]} />
              <meshStandardMaterial color={shirtColor} roughness={0.75} />
            </mesh>
            <group ref={forearmR} position={[0, -0.41, 0]}>
              <mesh position={[0, -0.18, 0]} castShadow>
                <capsuleGeometry args={[0.067, 0.24, 5, 10]} />
                <meshStandardMaterial color={shirtColor} roughness={0.76} />
              </mesh>
              <mesh position={[0, -0.295, 0.015]} castShadow>
                <capsuleGeometry args={[0.06, 0.10, 4, 8]} />
                <meshStandardMaterial color={skin} roughness={0.67} />
              </mesh>
              <group ref={handR} position={[0, -0.34, 0.035]}>
                <mesh castShadow>
                  <sphereGeometry args={[0.075, 12, 10]} />
                  <meshStandardMaterial color={skin} roughness={0.62} />
                </mesh>
                <mesh position={[-0.04, -0.04, 0.018]} rotation={[0.3, 0, -0.1]}>
                  <capsuleGeometry args={[0.018, 0.055, 3, 6]} />
                  <meshStandardMaterial color={skin} roughness={0.64} />
                </mesh>
                <mesh position={[0.0, -0.05, 0.022]}>
                  <capsuleGeometry args={[0.018, 0.06, 3, 6]} />
                  <meshStandardMaterial color={skin} roughness={0.64} />
                </mesh>
                <mesh position={[0.04, -0.04, 0.015]} rotation={[0.2, 0, 0.1]}>
                  <capsuleGeometry args={[0.017, 0.05, 3, 6]} />
                  <meshStandardMaterial color={skin} roughness={0.64} />
                </mesh>
              </group>
            </group>
          </group>
        </group>

        {/* Donghua-lite face: cleaner silhouette, expressive eyes, subtle brows and blush. */}
        <group ref={head} position={[0, 1.83, 0]}>
          <mesh scale={[0.88, 1.08, 0.88]} castShadow receiveShadow>
            <sphereGeometry args={[0.235, 24, 20]} />
            <meshStandardMaterial color={skin} roughness={0.56} />
          </mesh>
          {showFace && (
            <>
              {/* Slightly larger almond-shaped eyes */}
              {[-1, 1].map((side) => (
                <group key={side} ref={side < 0 ? eyeL : eyeR} position={[side * 0.082, 0.012, 0.183]}>
                  <mesh scale={[1.0, 1.15, 0.56]}>
                    <sphereGeometry args={[0.047, 16, 14]} />
                    <meshStandardMaterial color="#fffaf4" roughness={0.35} />
                  </mesh>
                  <mesh position={[side * -0.004, -0.003, 0.022]} scale={[0.72, 0.93, 0.62]}>
                    <sphereGeometry args={[0.037, 14, 12]} />
                    <meshStandardMaterial color={eyeColor} roughness={0.25} />
                  </mesh>
                  <mesh position={[side * -0.004, -0.002, 0.039]} scale={[0.56, 0.70, 0.55]}>
                    <sphereGeometry args={[0.026, 12, 10]} />
                    <meshStandardMaterial color="#171b27" roughness={0.25} />
                  </mesh>
                  <mesh position={[-0.01, 0.016, 0.052]}>
                    <sphereGeometry args={[0.009, 8, 8]} />
                    <meshBasicMaterial color="#ffffff" />
                  </mesh>
                </group>
              ))}
              <mesh position={[0, -0.040, 0.203]}>
                <sphereGeometry args={[0.021, 10, 8]} />
                <meshStandardMaterial color={skin} roughness={0.62} />
              </mesh>
              {/* Soft cheek highlights */}
              {[-1, 1].map((side) => (
                <mesh key={side} position={[side * 0.125, -0.07, 0.158]} scale={[1.0, 0.45, 0.18]}>
                  <sphereGeometry args={[0.035, 10, 8]} />
                  <meshStandardMaterial color="#d77778" transparent opacity={0.18} roughness={0.9} />
                </mesh>
              ))}
              {[-1, 1].map((side) => (
                <group key={`brow-${side}`} ref={side < 0 ? browL : browR} position={[side * 0.082, 0.069, 0.186]}>
                  <mesh rotation={[0, 0, side * -0.10]}>
                    <boxGeometry args={[0.088, 0.014, 0.018]} />
                    <meshStandardMaterial color={hair} roughness={0.88} />
                  </mesh>
                </group>
              ))}
              <group ref={mouth} position={[0, -0.115, 0.194]}>
                <mesh>
                  <boxGeometry args={[0.065, 0.012, 0.013]} />
                  <meshStandardMaterial color="#8d3c50" roughness={0.55} />
                </mesh>
                <mesh position={[0, -0.015, -0.004]}>
                  <boxGeometry args={[0.035, 0.006, 0.006]} />
                  <meshStandardMaterial color="#eaa5a0" roughness={0.5} />
                </mesh>
              </group>
              {/* Ears */}
              {[-1, 1].map((side) => (
                <mesh key={side} position={[side * 0.207, -0.005, -0.005]} scale={[0.55, 0.85, 0.48]}>
                  <sphereGeometry args={[0.065, 10, 10]} />
                  <meshStandardMaterial color={skin} roughness={0.65} />
                </mesh>
              ))}
            </>
          )}

          {/* Sculpted hair cap and directional fringe */}
          <mesh position={[0, 0.17, -0.015]} scale={[1.03, 0.60, 0.99]} castShadow>
            <sphereGeometry args={[0.245, 20, 16]} />
            <meshStandardMaterial color={hair} roughness={0.78} />
          </mesh>
          <mesh position={[-0.07, 0.105, 0.155]} rotation={[0.05, 0, -0.17]} castShadow>
            <coneGeometry args={[0.091, 0.22, 6]} />
            <meshStandardMaterial color={hair} roughness={0.78} />
          </mesh>
          <mesh position={[0.045, 0.10, 0.17]} rotation={[0.05, 0, 0.13]} castShadow>
            <coneGeometry args={[0.085, 0.20, 6]} />
            <meshStandardMaterial color={hair} roughness={0.78} />
          </mesh>
          <mesh position={[0.14, 0.15, 0.12]} rotation={[0.18, 0, 0.25]} castShadow>
            <coneGeometry args={[0.07, 0.17, 5]} />
            <meshStandardMaterial color={hair} roughness={0.78} />
          </mesh>

          {style === 1 && (
            <>
              <mesh position={[-0.18, -0.04, -0.015]} rotation={[0.02, 0, -0.06]} castShadow>
                <capsuleGeometry args={[0.075, 0.28, 5, 10]} />
                <meshStandardMaterial color={hair} roughness={0.82} />
              </mesh>
              <mesh position={[0.18, -0.04, -0.015]} rotation={[0.02, 0, 0.06]} castShadow>
                <capsuleGeometry args={[0.075, 0.28, 5, 10]} />
                <meshStandardMaterial color={hair} roughness={0.82} />
              </mesh>
            </>
          )}
          {style === 2 && (
            <>
              <mesh position={[-0.205, -0.10, -0.035]} rotation={[0, 0, 0.06]} castShadow>
                <capsuleGeometry args={[0.065, 0.40, 5, 10]} />
                <meshStandardMaterial color={hair} roughness={0.82} />
              </mesh>
              <mesh position={[0.205, -0.10, -0.035]} rotation={[0, 0, -0.06]} castShadow>
                <capsuleGeometry args={[0.065, 0.40, 5, 10]} />
                <meshStandardMaterial color={hair} roughness={0.82} />
              </mesh>
            </>
          )}
          {style === 3 && (
            <>
              <mesh position={[0, 0.29, -0.055]} scale={[0.80, 0.65, 0.80]} castShadow>
                <sphereGeometry args={[0.115, 12, 10]} />
                <meshStandardMaterial color={hair} roughness={0.85} />
              </mesh>
              {[-0.18, 0, 0.18].map((x) => (
                <mesh key={x} position={[x, 0.205, -0.08]} rotation={[0.2, 0, x * 0.5]} castShadow>
                  <sphereGeometry args={[0.09, 10, 8]} />
                  <meshStandardMaterial color={hair} roughness={0.85} />
                </mesh>
              ))}
            </>
          )}
        </group>

        {/* Tiny hand props make reading/eating less like a pure stat change. */}
        <group ref={book} position={[0.02, 1.17, 0.32]} rotation={[-0.25, 0, -0.08]} visible={false}>
          <mesh castShadow>
            <boxGeometry args={[0.28, 0.035, 0.20]} />
            <meshStandardMaterial color="#7c2d3d" roughness={0.84} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.25, 0.008, 0.18]} />
            <meshStandardMaterial color="#f3e7ca" roughness={0.92} />
          </mesh>
          <mesh position={[0, 0.026, 0]}>
            <boxGeometry args={[0.008, 0.008, 0.18]} />
            <meshStandardMaterial color="#a0a9b2" roughness={0.9} />
          </mesh>
        </group>
        <group ref={propFood} position={[0.42, 1.14, 0.35]} visible={false}>
          <mesh castShadow>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshStandardMaterial color="#d94b43" roughness={0.48} />
          </mesh>
          <mesh position={[0, 0.075, 0]} rotation={[0, 0, -0.25]}>
            <cylinderGeometry args={[0.009, 0.012, 0.05, 6]} />
            <meshStandardMaterial color="#65844b" roughness={0.7} />
          </mesh>
        </group>
        </group>
      </group>
    </group>
  );
}

type AvatarProps = {
  appearance: CharacterAppearance;
  shirtColor?: string;
  pantsColor?: string;
  showFace?: boolean;
  animation?: string;
};

class RiggedAvatarErrorBoundary extends Component<{
  children: ReactNode;
  fallback: ReactNode;
}, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

/** Prefer the skeletal GLB avatar; preserve the procedural character as a safe fallback. */
export function Avatar(props: AvatarProps) {
  return (
    <RiggedAvatarErrorBoundary fallback={<ProceduralAvatar {...props} />}>
      <Suspense fallback={<ProceduralAvatar {...props} />}>
        <RiggedAvatar {...props} />
      </Suspense>
    </RiggedAvatarErrorBoundary>
  );
}

const TOP_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#a855f7", "#f59e0b", "#06b6d4", "#ec4899", "#64748b",
  "#1e3a5f", "#f8fafc", "#111827", "#f97316", "#14b8a6", "#7c3aed", "#be123c", "#84cc16",
];
const BOTTOM_COLORS = [
  "#1e293b", "#334155", "#0f172a", "#3f3f46", "#1d4ed8", "#166534", "#7c2d12", "#4c1d95",
  "#292524", "#44403c", "#1e40af", "#14532d", "#78716c", "#365314", "#831843", "#164e63",
];

/** Shirt color from clothingTop + appearance so wardrobes vary. */
export function shirtFromAppearance(appearance: CharacterAppearance, seed = 0): string {
  const top = Math.abs(Math.floor(appearance?.clothingTop ?? 0));
  const n = Math.abs(Math.floor(top * 5 + (appearance?.skinTone ?? 0.5) * 12 + (appearance?.hairStyle ?? 0) * 3 + seed));
  return TOP_COLORS[n % TOP_COLORS.length];
}

/** Pants color from clothingBottom. */
export function pantsFromAppearance(appearance: CharacterAppearance, seed = 0): string {
  const bottom = Math.abs(Math.floor(appearance?.clothingBottom ?? 0));
  const n = Math.abs(Math.floor(bottom * 3 + (appearance?.hairStyle ?? 0) + seed));
  return BOTTOM_COLORS[n % BOTTOM_COLORS.length];
}

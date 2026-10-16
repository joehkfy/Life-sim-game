import { useEffect, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import type { CharacterAppearance } from "@life-sim/shared";

/**
 * Primary: Donghua humanoid (life-sim proportions, full locomotion + emotes) — Idle/Walk/Run/Jump/Sit/Cheer + many more clips.
 * Optional alt: Young Warrior (limited clips: stand_free/run only).
 * Procedural Avatar remains the final safety net via Avatar.tsx error boundary.
 */
const MODEL_URL = "/models/characters/life-sim-donghua-base.glb";
const ALT_MODEL_URL = "/models/characters/life-sim-young-warrior.glb";

type RiggedAvatarProps = {
  appearance: CharacterAppearance;
  shirtColor?: string;
  pantsColor?: string;
  showFace?: boolean;
  animation?: string;
};

/**
 * Map game animation keys → clip names.
 * Young Warrior pack ships: stand_free, run, run_armed (+ Armature suffix from glTF).
 * Donghua base used Idle/Walk/Run/… — resolveClip() tries both naming styles.
 */
const ACTION_CLIPS: Record<string, string> = {
  idle: "Idle",
  walk: "Walk",
  run: "Run",
  sleep: "Sleep",
  waking: "WakeUp",
  stand_up: "StandUp",
  relax: "Relax",
  watch_tv: "WatchTVStanding",
  watch_tv_sit: "WatchTV",
  get_snack: "Eat",
  cook: "Cook",
  shower: "Shower",
  work_on_computer: "Type",
  read: "Read",
  sit: "SitIdle",
  phone: "Phone",
  phone_typing: "PhoneTyping",
  wave: "Wave",
  jump: "Jump",
  land: "Land",
  crouch: "Crouch",
  drink: "Drink",
  open_door: "OpenDoor",
  reach: "Reach",
  pick_up: "PickUp",
  pickup: "PickUp",
  carry: "Carry",
  put_down: "PutDown",
  talk: "Talk",
  laugh: "Laugh",
  clap: "Clap",
  shrug: "Shrug",
  point: "Point",
  handshake: "Handshake",
  fist_bump: "FistBump",
  celebrate: "Celebrate",
  stretch: "Stretch",
  yawn: "Yawn",
  nod: "Nod",
  shake_head: "ShakeHead",
  look_at: "LookAt",
  idle_holding: "IdleHolding",
  dance: "Dance",
  wash_hands: "WashHands",
  brush_teeth: "BrushTeeth",
  kneel: "Kneel",
};

/** Fallback clip names if a lighter GLB (Young Warrior) is ever used. */
const LEGACY_ACTION_CLIPS: Record<string, string> = {
  idle: "stand_free",
  walk: "run",
  run: "run",
  sleep: "stand_free",
  waking: "stand_free",
  stand_up: "stand_free",
  relax: "stand_free",
  watch_tv: "stand_free",
  watch_tv_sit: "stand_free",
  get_snack: "stand_free",
  cook: "stand_free",
  shower: "stand_free",
  work_on_computer: "stand_free",
  read: "stand_free",
  sit: "stand_free",
  phone: "stand_free",
  phone_typing: "stand_free",
  wave: "stand_free",
  jump: "run",
  land: "stand_free",
  crouch: "stand_free",
  drink: "stand_free",
  open_door: "stand_free",
  reach: "stand_free",
  pick_up: "stand_free",
  pickup: "stand_free",
  carry: "stand_free",
  put_down: "stand_free",
  talk: "stand_free",
  laugh: "stand_free",
  clap: "stand_free",
  shrug: "stand_free",
  point: "stand_free",
  handshake: "stand_free",
  fist_bump: "stand_free",
  celebrate: "run",
  stretch: "stand_free",
  yawn: "stand_free",
  nod: "stand_free",
  shake_head: "stand_free",
  look_at: "stand_free",
  idle_holding: "stand_free",
  dance: "run",
  wash_hands: "stand_free",
  brush_teeth: "stand_free",
  kneel: "stand_free",
};

function resolveClipName(
  actions: Record<string, THREE.AnimationAction | null>,
  preferred: string,
  legacy?: string,
): string | null {
  const candidates = [
    preferred,
    `${preferred}_Armature`,
    preferred.replace(/_Armature$/, ""),
    legacy,
    legacy ? `${legacy}_Armature` : null,
  ].filter(Boolean) as string[];
  for (const name of candidates) {
    if (actions[name]) return name;
  }
  // Fuzzy: any clip whose name contains the preferred token
  const keys = Object.keys(actions);
  const token = preferred.toLowerCase();
  const fuzzy = keys.find((k) => k.toLowerCase().includes(token));
  if (fuzzy) return fuzzy;
  if (actions.stand_free) return "stand_free";
  if (actions.stand_free_Armature) return "stand_free_Armature";
  if (actions.Idle) return "Idle";
  return keys[0] || null;
}

function findBone(root: THREE.Object3D, names: string[]): THREE.Bone | undefined {
  // Also try KayKit-style prefixes (Rogue_/Mage_/Knight_)
  const expanded = [...names];
  for (const n of names) {
    for (const prefix of ["Rogue_", "Mage_", "Knight_", "Barbarian_"]) {
      if (!n.startsWith(prefix)) expanded.push(prefix + n.replace(/^(mixamorig|Armature_)/, ""));
    }
  }
  for (const name of expanded) {
    const obj = root.getObjectByName(name);
    if (obj && (obj as THREE.Bone).isBone) return obj as THREE.Bone;
  }
  // Case-insensitive fallback
  let found: THREE.Bone | undefined;
  root.traverse((o) => {
    if (found) return;
    if ((o as THREE.Bone).isBone && names.some((n) => n.toLowerCase() === o.name.toLowerCase())) {
      found = o as THREE.Bone;
    }
  });
  return found;
}

const SEATED_STATES = new Set(["relax", "watch_tv_sit", "work_on_computer", "sit"]);
const LOCOMOTION_STATES = new Set(["walk", "run"]);
const ONE_SHOT_STATES = new Set([
  "wave", "jump", "land", "open_door", "reach", "pick_up", "pickup", "put_down",
  "shrug", "point", "handshake", "fist_bump", "celebrate", "stretch", "yawn",
  "nod", "shake_head", "look_at", "kneel",
]);

function isSeated(state: string) {
  return SEATED_STATES.has(state);
}

function isLocomotion(state: string) {
  return LOCOMOTION_STATES.has(state);
}

function easeInOut(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}


/** Two-bone arm IK keeps hands close to interaction anchors while preserving
 * the authored elbow bend direction. Targets use model-local coordinates. */
function applyTwoBoneIK(
  model: THREE.Group,
  upper: THREE.Bone | undefined,
  lower: THREE.Bone | undefined,
  hand: THREE.Bone | undefined,
  targetLocal: THREE.Vector3,
) {
  if (!upper || !lower || !hand) return;
  model.updateMatrixWorld(true);
  const target = targetLocal.clone();
  model.localToWorld(target);
  const shoulder = upper.getWorldPosition(new THREE.Vector3());
  let elbow = lower.getWorldPosition(new THREE.Vector3());
  let wrist = hand.getWorldPosition(new THREE.Vector3());
  const upperLength = shoulder.distanceTo(elbow);
  const lowerLength = elbow.distanceTo(wrist);
  if (upperLength < 0.05 || lowerLength < 0.05) return;

  const toTarget = target.clone().sub(shoulder);
  const distance = THREE.MathUtils.clamp(
    toTarget.length(),
    Math.abs(upperLength - lowerLength) + 0.015,
    upperLength + lowerLength - 0.015,
  );
  const direction = toTarget.normalize();
  const reachableTarget = shoulder.clone().addScaledVector(direction, distance);
  const along = (upperLength * upperLength + distance * distance - lowerLength * lowerLength) / (2 * distance);
  const perpendicularLength = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  let bend = elbow.clone().sub(shoulder);
  bend.addScaledVector(direction, -bend.dot(direction));
  if (bend.lengthSq() < 1e-6) bend = new THREE.Vector3(0, 0, 1).cross(direction);
  if (bend.lengthSq() < 1e-6) bend = new THREE.Vector3(0, 1, 0).cross(direction);
  bend.normalize();
  const desiredElbow = shoulder.clone().addScaledVector(direction, along).addScaledVector(bend, perpendicularLength);

  const setWorldRotation = (bone: THREE.Bone, currentVector: THREE.Vector3, desiredVector: THREE.Vector3) => {
    if (currentVector.lengthSq() < 1e-8 || desiredVector.lengthSq() < 1e-8 || !bone.parent) return;
    const currentWorld = bone.getWorldQuaternion(new THREE.Quaternion());
    const delta = new THREE.Quaternion().setFromUnitVectors(currentVector.normalize(), desiredVector.normalize());
    const targetWorld = delta.multiply(currentWorld);
    const parentWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(parentWorld.invert().multiply(targetWorld));
    model.updateMatrixWorld(true);
  };

  setWorldRotation(upper, elbow.clone().sub(shoulder), desiredElbow.clone().sub(shoulder));
  elbow = lower.getWorldPosition(new THREE.Vector3());
  wrist = hand.getWorldPosition(new THREE.Vector3());
  setWorldRotation(lower, wrist.clone().sub(elbow), reachableTarget.clone().sub(elbow));
}

function skinColor(appearance: CharacterAppearance) {
  const tone = THREE.MathUtils.clamp(appearance?.skinTone ?? 0.55, 0, 1);
  return new THREE.Color().setHSL(0.065, 0.42, 0.27 + tone * 0.48);
}

function eyeColor(appearance: CharacterAppearance) {
  const colors = ["#7b5135", "#263f75", "#28735e", "#83539d"];
  const n = Math.abs(Math.floor(appearance?.facePreset ?? 0)) % colors.length;
  return new THREE.Color(colors[n]);
}

function customizeModel(
  root: THREE.Group,
  appearance: CharacterAppearance,
  shirtColor: string,
  pantsColor: string,
  showFace: boolean,
) {
  const hairStyle = Math.abs(Math.floor(appearance?.hairStyle ?? 0)) % 4;
  const skin = skinColor(appearance);
  root.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh) return;
    const mesh = object as THREE.Mesh;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    if (mesh.name.startsWith("HairStyle_")) {
      mesh.visible = Number(mesh.name.slice("HairStyle_".length)) === hairStyle;
    }
    // Young Warrior: single hair mesh — hide for style 3 (bald-ish) by scaling visibility
    if (mesh.name === "Mesh_Hair" || mesh.name.toLowerCase().includes("hair")) {
      mesh.visible = hairStyle !== 3;
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const customized = materials.map((original) => {
      const material = original.clone();
      if (!(material instanceof THREE.MeshStandardMaterial)) return material;
      const matName = material.name || "";
      const meshName = mesh.name || "";

      const isSkin =
        matName === "Mat_Skin" ||
        matName === "Mat_FingerSkin" ||
        matName === "Mat_SkinOverlay" ||
        matName === "body" ||
        matName === "head" ||
        meshName === "Mesh_Body" ||
        meshName === "Mesh_Head" ||
        meshName.startsWith("Mesh_Head");
      const isHair = matName === "Mat_Hair" || matName === "mat_hair" || meshName === "Mesh_Hair";
      const isIris =
        matName === "Mat_Iris" ||
        matName === "mat_eye" ||
        meshName.startsWith("Mesh_Iris") ||
        meshName.toLowerCase().includes("eye");

      if (isSkin) {
        // Preserve texture maps; warmer skin response under city lighting
        material.color.copy(skin);
        material.roughness = Math.min(0.72, Math.max(0.38, (material.roughness ?? 0.55)));
        material.metalness = 0.01;
        if ("envMapIntensity" in material) (material as THREE.MeshStandardMaterial).envMapIntensity = 0.55;
      } else if (isHair) {
        material.color.set(appearance?.hairColor || "#2c1810");
        material.roughness = 0.62;
        material.metalness = 0.04;
      } else if (matName === "Mat_Shirt") {
        material.color.set(shirtColor);
        material.roughness = 0.48;
        material.metalness = 0.05;
      } else if (matName === "Mat_Pants") {
        material.color.set(pantsColor);
        material.roughness = 0.62;
      } else if (isIris) {
        material.color.copy(eyeColor(appearance));
        material.roughness = 0.2;
        material.metalness = 0.08;
        material.emissive = eyeColor(appearance).multiplyScalar(0.08);
      } else if (matName === "Mat_Brow") {
        material.color.set(appearance?.hairColor || "#2c1810").multiplyScalar(0.72);
      }
      material.needsUpdate = true;
      return material;
    });
    mesh.material = Array.isArray(mesh.material) ? customized : customized[0];

    if (!showFace && (
      mesh.name.startsWith("Face_") ||
      mesh.name.startsWith("Mesh_Iris") ||
      ["Mesh_EyeWhite", "Mesh_Iris", "Mesh_Pupil", "Mesh_Brow", "Mesh_Mouth", "Mesh_SkinOverlay", "Mat_EyeWhite", "Mat_Iris", "Mat_Pupil", "Mat_Brow", "Mat_Mouth"].includes(mesh.name)
    )) {
      mesh.visible = false;
    }
  });

  // Lightweight clothing colour layers only when the mesh has no shirt/pants materials
  // (e.g. single-texture bodies). Skip when Donghua Mat_Shirt / Mat_Pants exist.
  let hasClothingMats = false;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (m && (m.name === "Mat_Shirt" || m.name === "Mat_Pants")) hasClothingMats = true;
    }
  });
  if (!hasClothingMats && !root.getObjectByName("LifeSim_ShirtOverlay")) {
    const spine =
      findBone(root, ["Spine3", "Spine2", "Spine1", "Chest", "spine"]) ||
      root;
    const shirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.42, 10),
      new THREE.MeshStandardMaterial({
        color: shirtColor,
        roughness: 0.55,
        metalness: 0.04,
        transparent: true,
        opacity: 0.92,
      }),
    );
    shirt.name = "LifeSim_ShirtOverlay";
    shirt.position.set(0, 0.12, 0.02);
    spine.add(shirt);

    const hip = findBone(root, ["Sacrum", "Sacrum.001", "Hips", "hips", "pelvis"]) || root;
    const pants = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.14, 0.38, 10),
      new THREE.MeshStandardMaterial({
        color: pantsColor,
        roughness: 0.7,
        transparent: true,
        opacity: 0.9,
      }),
    );
    pants.name = "LifeSim_PantsOverlay";
    pants.position.set(0, -0.05, 0);
    hip.add(pants);
  } else {
    const shirt = root.getObjectByName("LifeSim_ShirtOverlay") as THREE.Mesh | undefined;
    const pants = root.getObjectByName("LifeSim_PantsOverlay") as THREE.Mesh | undefined;
    if (shirt && shirt.material instanceof THREE.MeshStandardMaterial) shirt.material.color.set(shirtColor);
    if (pants && pants.material instanceof THREE.MeshStandardMaterial) pants.material.color.set(pantsColor);
  }
}

/**
 * GLB-based humanoid animator.
 * Locomotion stays in-place because Player owns world motion. The controller
 * adds clean start/stop blends, subtle foot/ankle compensation, low-amplitude
 * body motion and timed idle looks without introducing root-motion drift.
 */
export function RiggedAvatar({
  appearance,
  shirtColor = "#3b82f6",
  pantsColor = "#1e293b",
  showFace = true,
  animation = "idle",
}: RiggedAvatarProps) {
  const { scene, animations } = useGLTF(MODEL_URL);
  const pivot = useRef<THREE.Group>(null);
  const previousAnimation = useRef<string | null>(null);
  const currentAction = useRef<THREE.AnimationAction | null>(null);
  const transitionAction = useRef<THREE.AnimationAction | null>(null);
  const pendingLoop = useRef<string | null>(null);
  const sleepStartedAt = useRef(0);
  const wakeStartedAt = useRef(0);
  const idleLookDueAt = useRef(0);
  const nextBlinkAt = useRef(0);
  const blinkStartedAt = useRef<number | null>(null);
  const playClipRef = useRef<(clip: string, loop?: boolean, fade?: number) => void>(() => undefined);

  const model = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene) as THREE.Group;
    customizeModel(cloned, appearance, shirtColor, pantsColor, showFace);

    // Simple interaction props are children of their hand/chest bones so they
    // follow the rig rather than floating at a fixed world position.
    const rightHand =
      findBone(cloned, ["Hand_R", "hand001.R", "hand.R", "Hand.R", "mixamorigRightHand"]) ||
      cloned.getObjectByName("Hand_R");
    if (rightHand) {
      const apple = new THREE.Group();
      apple.name = "LifeSim_FoodProp";
      const fruit = new THREE.Mesh(
        new THREE.SphereGeometry(0.052, 14, 12),
        new THREE.MeshStandardMaterial({ color: "#d94b43", roughness: 0.48 }),
      );
      fruit.position.set(0, -0.018, 0.075);
      fruit.castShadow = true;
      apple.add(fruit);
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.006, 0.025, 6),
        new THREE.MeshStandardMaterial({ color: "#65844b", roughness: 0.7 }),
      );
      stem.position.set(0, 0.035, 0.075);
      apple.add(stem);
      apple.position.set(0, -0.015, 0.02);
      apple.visible = false;
      rightHand.add(apple);

      const cup = new THREE.Group();
      cup.name = "LifeSim_DrinkProp";
      const cupBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.034, 0.028, 0.085, 12),
        new THREE.MeshStandardMaterial({ color: "#e8f0f4", roughness: 0.3, metalness: 0.08 }),
      );
      cupBody.castShadow = true;
      cup.add(cupBody);
      const liquid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.029, 0.026, 0.008, 12),
        new THREE.MeshStandardMaterial({ color: "#8b5e34", roughness: 0.28 }),
      );
      liquid.position.y = 0.038;
      cup.add(liquid);
      cup.position.set(0, -0.012, 0.10);
      cup.rotation.x = -0.08;
      cup.visible = false;
      rightHand.add(cup);

      const phone = new THREE.Group();
      phone.name = "LifeSim_PhoneProp";
      const phoneBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.082, 0.009),
        new THREE.MeshStandardMaterial({ color: "#222b35", metalness: 0.25, roughness: 0.35 }),
      );
      phoneBody.castShadow = true;
      phone.add(phoneBody);
      const phoneScreen = new THREE.Mesh(
        new THREE.BoxGeometry(0.037, 0.068, 0.002),
        new THREE.MeshStandardMaterial({ color: "#5c9dbd", emissive: "#21485d", emissiveIntensity: 0.25, roughness: 0.3 }),
      );
      phoneScreen.position.z = 0.006;
      phone.add(phoneScreen);
      phone.position.set(0, -0.018, 0.095);
      phone.rotation.x = -0.15;
      phone.visible = false;
      rightHand.add(phone);
    }
    const chest =
      findBone(cloned, ["Chest", "Spine3", "Spine2", "spine"]) ||
      cloned.getObjectByName("Chest");
    if (chest) {
      const book = new THREE.Group();
      book.name = "LifeSim_BookProp";
      const cover = new THREE.Mesh(
        new THREE.BoxGeometry(0.30, 0.035, 0.22),
        new THREE.MeshStandardMaterial({ color: "#7c2d3d", roughness: 0.84 }),
      );
      cover.castShadow = true;
      book.add(cover);
      const pages = new THREE.Mesh(
        new THREE.BoxGeometry(0.27, 0.009, 0.195),
        new THREE.MeshStandardMaterial({ color: "#f3e7ca", roughness: 0.92 }),
      );
      pages.position.y = 0.022;
      book.add(pages);
      book.position.set(0, -0.10, 0.245);
      book.rotation.set(-0.18, 0, 0);
      book.visible = false;
      chest.add(book);

      const box = new THREE.Group();
      box.name = "LifeSim_CarryBoxProp";
      const boxBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.19, 0.17),
        new THREE.MeshStandardMaterial({ color: "#ba8654", roughness: 0.92 }),
      );
      boxBody.castShadow = true;
      box.add(boxBody);
      const tape = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.194, 0.174),
        new THREE.MeshStandardMaterial({ color: "#e8d5a4", roughness: 0.8 }),
      );
      tape.position.x = 0.015;
      box.add(tape);
      box.position.set(0, -0.14, 0.30);
      box.visible = false;
      chest.add(box);
    }
    if (rightHand) {
      const toothbrush = new THREE.Group();
      toothbrush.name = "LifeSim_ToothbrushProp";
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.009, 0.115, 8),
        new THREE.MeshStandardMaterial({ color: "#5cc4bc", roughness: 0.45 }),
      );
      handle.rotation.z = -0.15;
      toothbrush.add(handle);
      const bristles = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.018, 0.012),
        new THREE.MeshStandardMaterial({ color: "#f0f7fa", roughness: 0.55 }),
      );
      bristles.position.y = 0.058;
      toothbrush.add(bristles);
      toothbrush.position.set(0, 0.015, 0.105);
      toothbrush.rotation.z = -0.16;
      toothbrush.visible = false;
      rightHand.add(toothbrush);
    }
    return cloned;
  }, [scene, appearance?.skinTone, appearance?.hairColor, appearance?.hairStyle, appearance?.facePreset, shirtColor, pantsColor, showFace]);

  const { actions, mixer } = useAnimations(animations, model);
  const morphMeshes = useMemo(() => {
    const meshes: THREE.Mesh[] = [];
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) meshes.push(mesh);
    });
    return meshes;
  }, [model]);
  const bones = useMemo(() => ({
    upperArmL: findBone(model, ["UpperArm_L", "Humerus.L", "upperarm.l", "mixamorigLeftArm"]),
    lowerArmL: findBone(model, ["LowerArm_L", "LowerArm.L", "LowerArm.L.001", "forearm.l", "mixamorigLeftForeArm"]),
    handL: findBone(model, ["Hand_L", "hand001.L", "hand.L", "mixamorigLeftHand"]),
    upperArmR: findBone(model, ["UpperArm_R", "Humerus.R", "upperarm.r", "mixamorigRightArm"]),
    lowerArmR: findBone(model, ["LowerArm_R", "LowerArm.R", "LowerArm.R.001", "forearm.r", "mixamorigRightForeArm"]),
    handR: findBone(model, ["Hand_R", "hand001.R", "hand.R", "mixamorigRightHand"]),
    upperLegL: findBone(model, ["UpperLeg_L", "Femur.L", "thigh.l", "mixamorigLeftUpLeg"]),
    lowerLegL: findBone(model, ["LowerLeg_L", "Tibia.L", "Tibia.L.001", "shin.l", "mixamorigLeftLeg"]),
    footL: findBone(model, ["Foot_L", "Foot.L", "Foot.L.001", "mixamorigLeftFoot"]),
    upperLegR: findBone(model, ["UpperLeg_R", "Femur.R", "thigh.r", "mixamorigRightUpLeg"]),
    lowerLegR: findBone(model, ["LowerLeg_R", "Tibia.R", "Tibia.R.001", "shin.r", "mixamorigRightLeg"]),
    footR: findBone(model, ["Foot_R", "Foot.R", "Foot.R.001", "mixamorigRightFoot"]),
    hairL: findBone(model, ["HairTip_L", "hair.L"]),
    hairR: findBone(model, ["HairTip_R", "hair.R"]),
  }), [model]);

  const playClip = (clipName: string, loop = true, fade = 0.22) => {
    const resolved =
      resolveClipName(actions as Record<string, THREE.AnimationAction | null>, clipName, LEGACY_ACTION_CLIPS[clipName]) ||
      clipName;
    const next = actions[resolved];
    if (!next) return;
    const prev = currentAction.current;
    if (prev === next && next.isRunning()) return;

    next.reset();
    next.enabled = true;
    // Walk is mapped to the run clip on Young Warrior — slow it slightly
    const timeScale = clipName.toLowerCase().includes("walk") || resolved.toLowerCase().includes("walk") ? 0.72 : 1;
    next.setEffectiveTimeScale(timeScale);
    next.setEffectiveWeight(1);
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.play();
    if (prev && prev !== next) {
      prev.crossFadeTo(next, fade, false);
    } else {
      next.fadeIn(fade);
    }
    currentAction.current = next;
    transitionAction.current = loop ? null : next;
  };
  playClipRef.current = playClip;

  useEffect(() => {
    const onFinished = (event: any) => {
      if (event.action !== transitionAction.current) return;
      transitionAction.current = null;
      const next = pendingLoop.current;
      pendingLoop.current = null;
      if (next) playClipRef.current(next, true, 0.20);
    };
    mixer.addEventListener("finished", onFinished);
    return () => mixer.removeEventListener("finished", onFinished);
  }, [mixer]);

  useEffect(() => {
    if (previousAnimation.current === animation) return;
    const before = previousAnimation.current ?? "idle";
    previousAnimation.current = animation;
    pendingLoop.current = null;
    const now = performance.now();
    if (animation !== "idle") idleLookDueAt.current = now + 7000 + Math.random() * 6000;

    const preferred = ACTION_CLIPS[animation] || "Idle";
    const legacy = LEGACY_ACTION_CLIPS[animation];
    const clip = resolveClipName(actions as Record<string, THREE.AnimationAction | null>, preferred, legacy) || preferred;

    // Prefer rich Donghua transition clips when present; otherwise jump to resolved clip.
    if (animation === "sleep" && before !== "sleep" && before !== "waking") {
      sleepStartedAt.current = now;
      idleLookDueAt.current = now + 10000;
      if (actions.LieDown) {
        pendingLoop.current = resolveClipName(actions as Record<string, THREE.AnimationAction | null>, "Sleep", "Sleep") || clip;
        playClip("LieDown", false, 0.18);
      } else {
        playClip(clip, true, 0.2);
      }
      return;
    }
    if (animation === "waking") {
      wakeStartedAt.current = now;
      if (actions.WakeUp) {
        playClip("WakeUp", false, 0.16);
        pendingLoop.current = resolveClipName(actions as Record<string, THREE.AnimationAction | null>, "stand_free", "Idle") || "Idle";
      } else {
        playClip(clip, true, 0.2);
      }
      return;
    }
    if (animation === "stand_up") {
      if (actions.StandUp) {
        playClip("StandUp", false, 0.16);
        pendingLoop.current = resolveClipName(actions as Record<string, THREE.AnimationAction | null>, "stand_free", "Idle") || "Idle";
      } else {
        playClip(clip, true, 0.2);
      }
      return;
    }
    if (animation === "walk" && !isLocomotion(before)) {
      if (actions.WalkStart) {
        pendingLoop.current = resolveClipName(actions as Record<string, THREE.AnimationAction | null>, "run", "Walk") || "Walk";
        playClip("WalkStart", false, 0.20);
      } else {
        playClip(clip, true, 0.18);
      }
      return;
    }
    if (animation === "run" && !isLocomotion(before)) {
      if (actions.RunStart) {
        pendingLoop.current = resolveClipName(actions as Record<string, THREE.AnimationAction | null>, "run", "Run") || "Run";
        playClip("RunStart", false, 0.16);
      } else {
        playClip(clip, true, 0.16);
      }
      return;
    }
    if (animation === "idle" && before === "walk" && actions.WalkStop) {
      pendingLoop.current = resolveClipName(actions as Record<string, THREE.AnimationAction | null>, "stand_free", "Idle") || "Idle";
      playClip("WalkStop", false, 0.16);
      return;
    }
    if (animation === "idle" && before === "run" && actions.RunStop) {
      pendingLoop.current = resolveClipName(actions as Record<string, THREE.AnimationAction | null>, "stand_free", "Idle") || "Idle";
      playClip("RunStop", false, 0.13);
      return;
    }

    if (ONE_SHOT_STATES.has(animation)) {
      const returnKey = isSeated(before) ? before : "idle";
      pendingLoop.current =
        resolveClipName(
          actions as Record<string, THREE.AnimationAction | null>,
          ACTION_CLIPS[returnKey] || "Idle",
          LEGACY_ACTION_CLIPS[returnKey],
        ) || "Idle";
      playClip(clip, false, 0.16);
      return;
    }

    const runningName = currentAction.current?.getClip()?.name || "";
    if (
      animation === "idle" &&
      currentAction.current?.isRunning() &&
      (runningName === "Idle" || runningName.includes("stand_free"))
    ) {
      return;
    }
    playClip(clip, true, animation === "walk" || animation === "run" ? 0.15 : 0.22);
  }, [animation, actions]);

  useFrame((_, delta) => {
    if (!pivot.current) return;
    const dt = Math.min(delta, 0.05);
    const now = performance.now();
    const isSleeping = animation === "sleep";
    const isWaking = animation === "waking";

    // Rotate around approximately hip level, but time it to match the actual
    // LieDown/WakeUp clips. Sitting no longer moves the whole model below the
    // seat, which was causing hips to sink into furniture.
    let sleepTilt = 0;
    let sleepLift = 0;
    if (isSleeping) {
      const progress = easeInOut((now - sleepStartedAt.current) / 900);
      sleepTilt = -Math.PI / 2 * progress;
      sleepLift = 0.075 * progress;
    } else if (isWaking) {
      const progress = easeInOut((now - wakeStartedAt.current) / 1120);
      sleepTilt = -Math.PI / 2 * (1 - progress);
      sleepLift = 0.075 * (1 - progress);
    }
    pivot.current.rotation.x = THREE.MathUtils.damp(pivot.current.rotation.x, sleepTilt, isWaking ? 12 : 10, dt);
    pivot.current.position.y = THREE.MathUtils.damp(pivot.current.position.y, 0.8 + sleepLift, 10, dt);

    // Locomotion foot compensation reduces visibly tilted soles when knees bend.
    // The authored clips remain in-place and the server-owned character root is
    // never moved by animation, avoiding double motion in multiplayer.
    const moving = animation === "walk" || animation === "run";
    const action = currentAction.current;
    const clipName = action?.getClip().name || "";
    const steadyWalk = animation === "walk" && clipName === "Walk";
    const steadyRun = animation === "run" && clipName === "Run";
    const duration = action?.getClip().duration || 1;
    const phase = action ? ((action.time % duration) / duration) * Math.PI * 2 : now * 4;
    const runLift = animation === "run" ? 0.11 : 0.055;
    const applyFoot = (upper?: THREE.Bone, lower?: THREE.Bone, foot?: THREE.Bone, phaseOffset = 0) => {
      if (!upper || !lower || !foot) return;
      const toeLift = (steadyWalk || steadyRun) ? runLift * Math.max(0, Math.sin(phase + phaseOffset)) : 0;
      const desired = moving ? -0.62 * (upper.rotation.x + lower.rotation.x) + toeLift : 0;
      foot.rotation.x = THREE.MathUtils.damp(foot.rotation.x, desired, moving ? 18 : 14, dt);
    };
    if (moving) {
      applyFoot(bones.upperLegL, bones.lowerLegL, bones.footL, 0);
      applyFoot(bones.upperLegR, bones.lowerLegR, bones.footR, Math.PI);
    } else if (animation === "idle" || animation === "stand_up" || animation === "waking") {
      applyFoot(bones.upperLegL, bones.lowerLegL, bones.footL, 0);
      applyFoot(bones.upperLegR, bones.lowerLegR, bones.footR, Math.PI);
    }

    // Lightweight facial performance: natural timed blinks plus expression
    // morphs driven by the current action. These morphs are shared by all
    // humanoid instances and do not require a separate facial skeleton.
    if (!nextBlinkAt.current) nextBlinkAt.current = now + 2400 + Math.random() * 2400;
    if (blinkStartedAt.current === null && now >= nextBlinkAt.current) blinkStartedAt.current = now;
    let blink = 0;
    if (animation === "sleep") {
      blink = 1;
    } else if (animation === "waking") {
      const wakingProgress = easeInOut((now - wakeStartedAt.current) / 1120);
      blink = 1 - wakingProgress;
    } else if (blinkStartedAt.current !== null) {
      const blinkProgress = (now - blinkStartedAt.current) / 170;
      if (blinkProgress >= 1) {
        blinkStartedAt.current = null;
        nextBlinkAt.current = now + 2600 + Math.random() * 3800;
      } else {
        blink = Math.sin(Math.PI * THREE.MathUtils.clamp(blinkProgress, 0, 1));
      }
    }
    const mouthOpen = animation === "talk" || animation === "phone_typing"
      ? 0.12 + 0.15 * Math.max(0, Math.sin(now * 0.014))
      : animation === "laugh" ? 0.55 + 0.20 * Math.max(0, Math.sin(now * 0.018))
      : animation === "yawn" ? 0.90
      : animation === "get_snack" || animation === "drink" ? 0.12 + 0.35 * Math.max(0, Math.sin(now * 0.005))
      : 0;
    const smile = animation === "laugh" || animation === "celebrate" ? 0.86
      : animation === "wave" || animation === "clap" ? 0.42
      : animation === "talk" ? 0.16 : 0;
    const browUp = animation === "celebrate" || animation === "jump" ? 0.44
      : animation === "wave" || animation === "shrug" ? 0.24 : 0;
    const browFrown = animation === "crouch" ? 0.16 : 0;
    for (const mesh of morphMeshes) {
      const dict = mesh.morphTargetDictionary;
      const weights = mesh.morphTargetInfluences;
      if (!dict || !weights) continue;
      if (dict.Blink !== undefined) weights[dict.Blink] = blink;
      if (dict.MouthOpen !== undefined) weights[dict.MouthOpen] = mouthOpen;
      if (dict.Smile !== undefined) weights[dict.Smile] = smile;
      if (dict.BrowUp !== undefined) weights[dict.BrowUp] = browUp;
      if (dict.BrowFrown !== undefined) weights[dict.BrowFrown] = browFrown;
    }
    const foodProp = model.getObjectByName("LifeSim_FoodProp");
    if (foodProp) foodProp.visible = animation === "get_snack";
    const drinkProp = model.getObjectByName("LifeSim_DrinkProp");
    if (drinkProp) drinkProp.visible = animation === "drink";
    const phoneProp = model.getObjectByName("LifeSim_PhoneProp");
    if (phoneProp) phoneProp.visible = animation === "phone" || animation === "phone_typing";
    const bookProp = model.getObjectByName("LifeSim_BookProp");
    if (bookProp) bookProp.visible = animation === "read";
    const boxProp = model.getObjectByName("LifeSim_CarryBoxProp");
    if (boxProp) {
      const actionTime = currentAction.current?.time ?? 0;
      boxProp.visible = animation === "carry" || animation === "idle_holding" ||
        (animation === "pick_up" && actionTime > 0.30) ||
        (animation === "put_down" && actionTime < 0.62);
    }
    const toothbrushProp = model.getObjectByName("LifeSim_ToothbrushProp");
    if (toothbrushProp) toothbrushProp.visible = animation === "brush_teeth";

    // Hand targets are expressed in character-local coordinates and move with
    // the character. This is a lightweight IK pass over authored clips: it
    // helps fingers reach keyboards/books/food/door areas without replacing
    // the animation's overall body language.
    const handTargets: Array<{ side: "L" | "R"; target: [number, number, number] }> = [];
    if (animation === "work_on_computer") {
      handTargets.push({ side: "L", target: [-0.19, 0.98, 0.38] }, { side: "R", target: [0.19, 0.98, 0.38] });
    } else if (animation === "read") {
      handTargets.push({ side: "L", target: [-0.14, 1.17, 0.34] }, { side: "R", target: [0.14, 1.17, 0.34] });
    } else if (animation === "cook") {
      handTargets.push({ side: "L", target: [-0.23, 1.02, 0.34] }, { side: "R", target: [0.23, 1.02, 0.34] });
    } else if (animation === "get_snack") {
      handTargets.push({ side: "R", target: [0.08, 1.57, 0.24] });
    } else if (animation === "drink") {
      handTargets.push({ side: "R", target: [0.08, 1.55, 0.25] });
    } else if (animation === "phone" || animation === "phone_typing") {
      handTargets.push({ side: "R", target: [0.10, 1.39, 0.27] });
      if (animation === "phone_typing") handTargets.push({ side: "L", target: [-0.08, 1.31, 0.28] });
    } else if (animation === "shower") {
      handTargets.push({ side: "L", target: [-0.15, 1.38, 0.18] }, { side: "R", target: [0.15, 1.34, 0.18] });
    } else if (animation === "open_door") {
      handTargets.push({ side: "R", target: [0.31, 1.05, 0.43] });
    } else if (animation === "reach") {
      handTargets.push({ side: "R", target: [0.31, 1.28, 0.48] });
    } else if (animation === "point") {
      handTargets.push({ side: "R", target: [0.30, 1.40, 0.52] });
    } else if (animation === "wave") {
      handTargets.push({ side: "R", target: [0.42, 1.73, 0.05] });
    } else if (animation === "yawn") {
      handTargets.push({ side: "R", target: [0.11, 1.56, 0.22] });
    } else if (animation === "wash_hands") {
      handTargets.push({ side: "L", target: [-0.10, 1.02, 0.28] }, { side: "R", target: [0.10, 1.02, 0.28] });
    } else if (animation === "brush_teeth") {
      handTargets.push({ side: "R", target: [0.10, 1.56, 0.23] });
    } else if (animation === "carry" || animation === "idle_holding") {
      handTargets.push({ side: "L", target: [-0.14, 1.04, 0.43] }, { side: "R", target: [0.14, 1.04, 0.43] });
    } else if (animation === "pick_up") {
      const progress = easeInOut((currentAction.current?.time ?? 0) / Math.max(0.1, currentAction.current?.getClip().duration ?? 0.92));
      const handY = 0.30 + progress * 0.73;
      handTargets.push({ side: "L", target: [-0.14, handY, 0.40] }, { side: "R", target: [0.14, handY, 0.40] });
    } else if (animation === "put_down") {
      const progress = easeInOut((currentAction.current?.time ?? 0) / Math.max(0.1, currentAction.current?.getClip().duration ?? 0.82));
      const handY = 1.03 - progress * 0.71;
      handTargets.push({ side: "L", target: [-0.14, handY, 0.40] }, { side: "R", target: [0.14, handY, 0.40] });
    }
    for (const anchor of handTargets) {
      applyTwoBoneIK(
        model,
        anchor.side === "L" ? bones.upperArmL : bones.upperArmR,
        anchor.side === "L" ? bones.lowerArmL : bones.lowerArmR,
        anchor.side === "L" ? bones.handL : bones.handR,
        new THREE.Vector3(...anchor.target),
      );
    }

    // Secondary motion for longer side locks adds a small Donghua-style follow-through.
    // These bones are weighted only to the selectable medium/long hair locks.
    const hairIntensity = animation === "run" ? 0.18 : animation === "walk" ? 0.095 : animation === "jump" ? 0.22 : 0.012;
    const hairSwing = Math.sin(now * (animation === "run" ? 12 : 7.5)) * hairIntensity;
    if (bones.hairL) {
      bones.hairL.rotation.x = THREE.MathUtils.damp(bones.hairL.rotation.x, hairSwing, 8, dt);
      bones.hairL.rotation.z = THREE.MathUtils.damp(bones.hairL.rotation.z, -hairIntensity * 0.24, 7, dt);
    }
    if (bones.hairR) {
      bones.hairR.rotation.x = THREE.MathUtils.damp(bones.hairR.rotation.x, -hairSwing * 0.88, 8, dt);
      bones.hairR.rotation.z = THREE.MathUtils.damp(bones.hairR.rotation.z, hairIntensity * 0.24, 7, dt);
    }

    // Low-amplitude whole-body response gives walking/running some weight while
    // keeping feet near the floor. No root position is changed by animation.
    if (steadyWalk) {
      model.position.y = 0.008 * (0.5 - 0.5 * Math.cos(phase * 2));
    } else if (steadyRun) {
      model.position.y = 0.018 * (0.5 - 0.5 * Math.cos(phase * 2));
    } else if (animation === "idle") {
      model.position.y = 0.006 * Math.sin(now * 0.0018);
    } else if (animation === "sleep") {
      model.position.y = 0.0015 * Math.sin(now * 0.0026);
    } else {
      model.position.y = 0;
    }

    // Play a brief head/neck look at occasional quiet moments. It's a one-shot
    // clip that gracefully yields to player input or any interaction state.
    if (!idleLookDueAt.current) idleLookDueAt.current = now + 5000;
    if (
      animation === "idle" &&
      now >= idleLookDueAt.current &&
      currentAction.current?.getClip().name === "Idle" &&
      actions.IdleLook
    ) {
      idleLookDueAt.current = now + 7000 + Math.random() * 6000;
      pendingLoop.current = "Idle";
      playClipRef.current("IdleLook", false, 0.22);
    }
  });

  return (
    <group ref={pivot} position={[0, 0.82, 0]} scale={1.14}>
      {/* Child offset keeps the model grounded while the outer pivot moves */}
      <group position={[0, -0.8, 0]}>
        <primitive object={model} />
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_URL);
// Optional alt body (limited clips) — preloaded only if needed later
void ALT_MODEL_URL;

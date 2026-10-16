import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import * as THREE from "three";
import { sendMove } from "../systems/network";
import { useGameStore } from "../stores/gameStore";
import { useInputStore } from "../stores/inputStore";
import type { CharacterAppearance } from "@life-sim/shared";
import { Avatar, shirtFromAppearance, pantsFromAppearance } from "./Avatar";
import { canMoveTo } from "./collisionWorld";

const MOVE_SPEED = 5;
const RUN_SPEED = 9;
const INTERACTION_WALK_SPEED = 2.25;
const SEND_INTERVAL = 50;
const MOUSE_SENS = 0.0025;
const TOUCH_LOOK_SENS = 0.005;

interface FurnitureActionDetail {
  propertyId: string;
  action: string;
  furniture: {
    id: string;
    furnitureKey: string;
    x: number;
    z: number;
    rotation?: number;
    isOn?: boolean;
  };
}

interface ActiveInteraction {
  action: string;
  animationAction?: string;
  propertyId: string;
  targetFurnitureId: string;
  targetX: number;
  targetZ: number;
  targetRotation: number;
  durationMs: number;
  phase: "approach" | "play" | "recover";
  phaseStartedAt: number;
  blockedSeconds: number;
}

interface PlayerProps {
  appearance: CharacterAppearance;
  initialPosition: [number, number, number];
  initialRotation?: number;
}

const ACTION_DURATIONS: Record<string, number> = {
  sleep: 7800,
  relax: 6200,
  watch_tv: 6500,
  get_snack: 2800,
  cook: 5200,
  shower: 5600,
  work_on_computer: 6500,
  read: 6500,
  sit: 4400,
};

/**
 * Local movement controller. It also approaches nearby household objects and
 * plays the appropriate animation after the server accepts the interaction.
 * The selected animation is sent with movement updates so nearby players see it.
 */
export function Player({ appearance, initialPosition, initialRotation = 0 }: PlayerProps) {
  const group = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const [, getKeys] = useKeyboardControls();
  const lastSend = useRef(0);
  const yaw = useRef(initialRotation);
  const pitch = useRef(0.25);
  const isPointerLocked = useRef(false);
  const cameraReady = useRef(false);
  const touchLook = useRef<{ id: number; x: number; y: number } | null>(null);
  const interaction = useRef<ActiveInteraction | null>(null);
  const emote = useRef<{ animation: string; endsAt: number } | null>(null);
  const jumpStartedAt = useRef<number | null>(null);
  const jumpWasDown = useRef(false);
  const homeFurniture = useRef<{ propertyId: string; items: FurnitureActionDetail["furniture"][] } | null>(null);
  const cameraFocusY = useRef(1.5);
  const animationRef = useRef("idle");
  const [animation, setAnimationState] = useState("idle");

  const setAnimation = useCallback((next: string) => {
    if (animationRef.current === next) return;
    animationRef.current = next;
    setAnimationState(next);
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    const isTouch = "ontouchstart" in window;

    const onClick = () => {
      if (document.body.style.cursor === "pointer") return;
      if (!isPointerLocked.current && !isTouch) canvas.requestPointerLock();
    };
    const onLockChange = () => {
      isPointerLocked.current = document.pointerLockElement === canvas;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isPointerLocked.current) return;
      yaw.current -= e.movementX * MOUSE_SENS;
      pitch.current -= e.movementY * MOUSE_SENS;
      pitch.current = Math.max(-0.15, Math.min(0.55, pitch.current));
    };

    const onTouchStart = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.clientX > window.innerWidth * 0.45 && !touchLook.current) {
          touchLook.current = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!touchLook.current) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier !== touchLook.current.id) continue;
        const dx = t.clientX - touchLook.current.x;
        const dy = t.clientY - touchLook.current.y;
        touchLook.current.x = t.clientX;
        touchLook.current.y = t.clientY;
        yaw.current -= dx * TOUCH_LOOK_SENS;
        pitch.current -= dy * TOUCH_LOOK_SENS;
        pitch.current = Math.max(-0.15, Math.min(0.55, pitch.current));
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!touchLook.current) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchLook.current.id) touchLook.current = null;
      }
    };

    canvas.addEventListener("click", onClick);
    document.addEventListener("pointerlockchange", onLockChange);
    document.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);

    return () => {
      canvas.removeEventListener("click", onClick);
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [gl]);

  useEffect(() => {
    const onFurnitureList = (event: Event) => {
      const detail = (event as CustomEvent<{ propertyId: string; furniture: FurnitureActionDetail["furniture"][] }>).detail;
      if (detail?.propertyId && Array.isArray(detail.furniture)) {
        homeFurniture.current = { propertyId: detail.propertyId, items: detail.furniture };
      }
    };

    const onAction = (event: Event) => {
      const detail = (event as CustomEvent<FurnitureActionDetail>).detail;
      if (!detail?.propertyId || !detail.furniture || detail.action === "toggle") return;
      const current = useGameStore.getState().character;
      if (!current || current.location !== `home_${detail.propertyId}`) return;
      if (interaction.current) return;

      const clicked = detail.furniture;
      emote.current = null;
      jumpStartedAt.current = null;
      const available = homeFurniture.current?.propertyId === detail.propertyId ? homeFurniture.current.items : [clicked];
      let targetItem = clicked;
      let targetFurnitureId = clicked.id;
      let animationAction = detail.action;
      // Watching TV should use the nearest sofa when one exists, so the avatar
      // sits on the cushion and looks toward the actual screen instead of sitting in air.
      let localX = 0;
      let localZ = 0;
      let facingOffset = Math.PI;

      switch (detail.action) {
        case "sleep": localZ = 0.48; facingOffset = 0; break;
        case "relax": localZ = 0.10; facingOffset = 0; break;
        case "watch_tv": {
          const sofas = available.filter((candidate) => candidate.furnitureKey === "sofa_basic");
          const clickedX = clicked.x * 0.5;
          const clickedZ = clicked.z * 0.5;
          let sofa = sofas[0];
          if (sofas.length > 1) {
            sofa = sofas.reduce((best, next) => {
              const bestDistance = Math.hypot(best.x - clicked.x, best.z - clicked.z);
              const nextDistance = Math.hypot(next.x - clicked.x, next.z - clicked.z);
              return nextDistance < bestDistance ? next : best;
            });
          }
          if (sofa) {
            targetItem = sofa;
            targetFurnitureId = sofa.id;
            animationAction = "watch_tv_sit";
            localZ = 0.10;
            const sx = sofa.x * 0.5;
            const sz = sofa.z * 0.5;
            const seatAngle = Number.isFinite(sofa.rotation) ? Number(sofa.rotation) : 0;
            const seatX = sx + localZ * 0.5 * Math.sin(seatAngle);
            const seatZ = sz + localZ * 0.5 * Math.cos(seatAngle);
            const targetAngle = Math.atan2(clickedX - seatX, clickedZ - seatZ);
            localX = 0;
            facingOffset = targetAngle - seatAngle;
          } else {
            localZ = 1.4;
            facingOffset = Math.PI;
          }
          break;
        }
        case "get_snack": localZ = 1.12; facingOffset = Math.PI; break;
        case "cook": localZ = 1.05; facingOffset = Math.PI; break;
        case "shower": localZ = 0.88; facingOffset = Math.PI; break;
        case "work_on_computer": localZ = 1.12; facingOffset = Math.PI; break;
        case "read": localZ = 0.80; facingOffset = Math.PI; break;
        case "sit": localX = 1.70; facingOffset = -Math.PI / 2; break;
        default: return;
      }

      const itemX = targetItem.x * 0.5;
      const itemZ = targetItem.z * 0.5;
      // Furniture meshes are authored at full size inside a 0.5-scale house.
      // Scale local offsets too, otherwise the avatar stops much too far away.
      const offsetX = localX * 0.5;
      const offsetZ = localZ * 0.5;
      const itemRotation = Number.isFinite(targetItem.rotation) ? Number(targetItem.rotation) : 0;
      const targetX = itemX + offsetX * Math.cos(itemRotation) + offsetZ * Math.sin(itemRotation);
      const targetZ = itemZ - offsetX * Math.sin(itemRotation) + offsetZ * Math.cos(itemRotation);
      const targetRotation = itemRotation + facingOffset;
      interaction.current = {
        action: detail.action,
        animationAction,
        propertyId: detail.propertyId,
        targetFurnitureId,
        targetX,
        targetZ,
        targetRotation,
        durationMs: ACTION_DURATIONS[detail.action] ?? 5000,
        phase: "approach",
        phaseStartedAt: performance.now(),
        blockedSeconds: 0,
      };
      setAnimation("walk");
    };

    const emoteDurations: Record<string, number> = {
      wave: 1500,
      talk: 2600,
      laugh: 1900,
      clap: 1800,
      shrug: 900,
      point: 820,
      celebrate: 1500,
      stretch: 1700,
      yawn: 1650,
      drink: 1450,
      phone: 2200,
      phone_typing: 2400,
      nod: 820,
      shake_head: 900,
      look_at: 1050,
      pick_up: 960,
      put_down: 860,
      carry: 2600,
      open_door: 760,
      reach: 700,
      idle_holding: 2500,
      fist_bump: 850,
      handshake: 1150,
      dance: 4200,
      sit: 2800,
      crouch: 1500,
      kneel: 1100,
      wash_hands: 2600,
      brush_teeth: 2600,
    };
    const onEmote = (event: Event) => {
      const detail = (event as CustomEvent<{ animation?: string }>).detail;
      const next = detail?.animation;
      if (!next || interaction.current) return;
      if (!Object.prototype.hasOwnProperty.call(emoteDurations, next)) return;
      emote.current = { animation: next, endsAt: performance.now() + emoteDurations[next] };
      jumpStartedAt.current = null;
    };
    const onDoorAnimation = () => {
      if (interaction.current) return;
      emote.current = { animation: "open_door", endsAt: performance.now() + 760 };
      jumpStartedAt.current = null;
    };
    window.addEventListener("life-sim:home-furniture-list", onFurnitureList);
    window.addEventListener("life-sim:character-action", onAction);
    window.addEventListener("life-sim:play-emote", onEmote);
    window.addEventListener("life-sim:home-door", onDoorAnimation);
    window.addEventListener("life-sim:interior-door", onDoorAnimation);
    return () => {
      window.removeEventListener("life-sim:home-furniture-list", onFurnitureList);
      window.removeEventListener("life-sim:character-action", onAction);
      window.removeEventListener("life-sim:play-emote", onEmote);
      window.removeEventListener("life-sim:home-door", onDoorAnimation);
      window.removeEventListener("life-sim:interior-door", onDoorAnimation);
    };
  }, [setAnimation]);

  useFrame((_, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 0.05);
    const tp = useGameStore.getState().teleport;
    if (tp) {
      group.current.position.set(tp.x, tp.y, tp.z);
      useGameStore.getState().clearTeleport();
    }
    const keys = getKeys();
    const input = useInputStore.getState();
    const mx = input.mobileX;
    const mz = input.mobileZ;
    const mobileRun = input.mobileRun;
    const mobileJump = input.mobileJump;
    const currentCharacter = useGameStore.getState().character;
    const location = currentCharacter?.location || "city";
    const active = interaction.current;
    const movementInput = !!(keys.forward || keys.backward || keys.left || keys.right || Math.abs(mx) > 0.12 || Math.abs(mz) > 0.12);
    const jumpDown = !!keys.jump || mobileJump;
    const jumpPressed = jumpDown && !jumpWasDown.current;
    jumpWasDown.current = jumpDown;
    const seatedOrBusyState = ["sleep", "waking", "relax", "watch_tv_sit", "work_on_computer", "read", "sit", "cook", "shower", "get_snack"].includes(animationRef.current);
    if (jumpPressed && !active && !emote.current && !seatedOrBusyState) {
      jumpStartedAt.current = performance.now();
    }
    let anim = "idle";
    let jumpOffset = 0;

    const tryMoveTo = (nextX: number, nextZ: number, fromX: number, fromZ: number, ignoreFurnitureId?: string) => {
      if (canMoveTo(nextX, nextZ, location, fromX, fromZ, ignoreFurnitureId)) {
        group.current!.position.x = nextX;
        group.current!.position.z = nextZ;
        return true;
      }
      let moved = false;
      const canX = canMoveTo(nextX, fromZ, location, fromX, fromZ, ignoreFurnitureId);
      const canZ = canMoveTo(fromX, nextZ, location, fromX, fromZ, ignoreFurnitureId);
      if (canX) { group.current!.position.x = nextX; moved = true; }
      if (canZ) { group.current!.position.z = nextZ; moved = true; }
      return moved;
    };

    if (active && active.phase === "approach") {
      const dx = active.targetX - group.current.position.x;
      const dz = active.targetZ - group.current.position.z;
      const distance = Math.hypot(dx, dz);
      const targetAngle = Math.atan2(dx, dz);
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetAngle, 8, dt);

      if (distance <= 0.10) {
        active.phase = "play";
        active.phaseStartedAt = performance.now();
        anim = active.animationAction ?? active.action;
      } else {
        const travel = Math.min(distance, INTERACTION_WALK_SPEED * dt);
        const fromX = group.current.position.x;
        const fromZ = group.current.position.z;
        const moved = tryMoveTo(fromX + (dx / distance) * travel, fromZ + (dz / distance) * travel, fromX, fromZ, active.targetFurnitureId);
        if (!moved) active.blockedSeconds += dt;
        else active.blockedSeconds = 0;

        // If a placed object or wall blocks the final approach, do not leave
        // the player frozen forever; finish from the nearest reachable point.
        if ((active.blockedSeconds > 0.7 && distance < 1.8) || active.blockedSeconds > 3.2) {
          active.phase = "play";
          active.phaseStartedAt = performance.now();
          anim = active.animationAction ?? active.action;
        } else {
          anim = "walk";
        }
      }
    } else if (active && active.phase === "play") {
      anim = active.animationAction ?? active.action;
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, active.targetRotation, 10, dt);
      yaw.current = group.current.rotation.y;
      if (performance.now() - active.phaseStartedAt >= active.durationMs) {
        active.phase = "recover";
        active.phaseStartedAt = performance.now();
        const seatedAction = ["relax", "watch_tv_sit", "work_on_computer", "sit"].includes(active.animationAction ?? active.action);
        anim = active.action === "sleep" ? "waking" : seatedAction ? "stand_up" : "idle";
      }
    } else if (active && active.phase === "recover") {
      const seatedAction = ["relax", "watch_tv_sit", "work_on_computer", "sit"].includes(active.animationAction ?? active.action);
      anim = active.action === "sleep" ? "waking" : seatedAction ? "stand_up" : "idle";
      const recoveryMs = active.action === "sleep" ? 1120 : seatedAction ? 900 : 0;
      if (performance.now() - active.phaseStartedAt >= recoveryMs) {
        interaction.current = null;
        anim = "idle";
      }
    } else if (emote.current && performance.now() < emote.current.endsAt && !movementInput) {
      anim = emote.current.animation;
    } else {
      if (emote.current && (performance.now() >= emote.current.endsAt || movementInput)) emote.current = null;
      const run = keys.run || mobileRun;
      let vehicleSpeed = 0;
      try { vehicleSpeed = Number(localStorage.getItem("life-sim-vehicle-speed") || 0); } catch { /* ignore */ }
      const speed = (run ? RUN_SPEED : MOVE_SPEED) + (vehicleSpeed > 0 ? vehicleSpeed * 0.12 : 0);
      const moveDir = new THREE.Vector3(0, 0, 0);
      if (keys.forward) moveDir.z -= 1;
      if (keys.backward) moveDir.z += 1;
      if (keys.left) moveDir.x -= 1;
      if (keys.right) moveDir.x += 1;
      if (!keys.forward && !keys.backward && !keys.left && !keys.right) {
        if (Math.abs(mx) > 0.12 || Math.abs(mz) > 0.12) {
          moveDir.x = mx;
          moveDir.z = mz;
        }
      }

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();
        const sin = Math.sin(yaw.current);
        const cos = Math.cos(yaw.current);
        const worldX = moveDir.x * cos + moveDir.z * sin;
        const worldZ = -moveDir.x * sin + moveDir.z * cos;
        const fromX = group.current.position.x;
        const fromZ = group.current.position.z;
        const nextX = THREE.MathUtils.clamp(fromX + worldX * speed * dt, -325, 325);
        const nextZ = THREE.MathUtils.clamp(fromZ + worldZ * speed * dt, -325, 325);
        tryMoveTo(nextX, nextZ, fromX, fromZ);
        const targetRot = Math.atan2(worldX, worldZ);
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetRot, 10 * dt);
        anim = run ? "run" : "walk";
      }
    }

    // Real jump arc is world-space (and synchronized to remote players), while
    // the Jump/Land clips supply the matching skeletal motion. The root returns
    // exactly to the floor before normal control resumes.
    if (jumpStartedAt.current !== null && !active) {
      const elapsed = (performance.now() - jumpStartedAt.current) / 1000;
      const flightSeconds = 0.62;
      const recoverSeconds = 0.86;
      if (elapsed <= flightSeconds) {
        const progress = THREE.MathUtils.clamp(elapsed / flightSeconds, 0, 1);
        jumpOffset = Math.sin(progress * Math.PI) * 0.78;
        anim = elapsed < 0.39 ? "jump" : "land";
      } else if (elapsed <= recoverSeconds) {
        jumpOffset = 0;
        anim = "land";
      } else {
        jumpStartedAt.current = null;
      }
    }
    group.current.position.y = jumpOffset;

    // Third-person camera follows the real character root and stays smooth during actions.
    const distance = 6.5;
    const height = 2.8;
    const camX = group.current.position.x - Math.sin(yaw.current) * distance;
    const camZ = group.current.position.z - Math.cos(yaw.current) * distance;
    const camY = group.current.position.y + height + pitch.current * 2.5;
    const targetCam = new THREE.Vector3(camX, Math.max(1.5, camY), camZ);
    if (!cameraReady.current) {
      camera.position.copy(targetCam);
      cameraReady.current = true;
    } else {
      camera.position.lerp(targetCam, 1 - Math.exp(-10 * dt));
    }
    const desiredFocusY = (anim === "sleep" || anim === "waking") ? 0.8 : 1.5;
    cameraFocusY.current = THREE.MathUtils.damp(cameraFocusY.current, desiredFocusY, 4.5, dt);
    camera.lookAt(new THREE.Vector3(
      group.current.position.x,
      group.current.position.y + cameraFocusY.current,
      group.current.position.z,
    ));

    setAnimation(anim);
    const now = performance.now();
    if (now - lastSend.current > SEND_INTERVAL) {
      lastSend.current = now;
      const pos = { x: group.current.position.x, y: group.current.position.y, z: group.current.position.z };
      sendMove(pos, group.current.rotation.y, anim);
      const ch = useGameStore.getState().character;
      if (ch) useGameStore.setState({ character: { ...ch, position: pos, rotation: group.current.rotation.y } });
    }
  });

  const shirt = shirtFromAppearance(appearance, 1);
  const pants = pantsFromAppearance(appearance, 2);
  return (
    <group ref={group} position={initialPosition} rotation={[0, initialRotation, 0]}>
      <Avatar appearance={appearance} shirtColor={shirt} pantsColor={pants} animation={animation} showFace />
    </group>
  );
}

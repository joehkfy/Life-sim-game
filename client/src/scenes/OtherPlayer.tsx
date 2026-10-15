import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PublicCharacter } from "@life-sim/shared";
import { Text } from "@react-three/drei";
import { shirtFromAppearance } from "./Avatar";
import { RiggedAvatar } from "./RiggedAvatar";

interface OtherPlayerProps {
  player: PublicCharacter;
}

export function OtherPlayer({ player }: OtherPlayerProps) {
  const group = useRef<THREE.Group>(null);
  const targetPos = useRef(
    new THREE.Vector3(player.position.x, player.position.y, player.position.z)
  );
  const targetRot = useRef(player.rotation);

  targetPos.current.set(player.position.x, player.position.y, player.position.z);
  targetRot.current = player.rotation;

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.position.lerp(targetPos.current, 10 * delta);
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      targetRot.current,
      10 * delta
    );
  });

  const appearance = player.appearance || {
    skinTone: 0.5,
    hairStyle: 0,
    hairColor: "#3d2314",
  };
  const shirt = shirtFromAppearance(appearance, player.name?.length || 0);

  return (
    <group ref={group} position={[player.position.x, player.position.y, player.position.z]}>
      <RiggedAvatar appearance={appearance} shirtColor={shirt} pantsColor="#334155" animation={player.animation || "idle"} />
      <Text
        position={[0, 2.35, 0]}
        fontSize={0.32}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.025}
        outlineColor="#000000"
      >
        {player.name}
      </Text>
    </group>
  );
}

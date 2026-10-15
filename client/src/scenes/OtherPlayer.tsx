import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PublicCharacter } from "@life-sim/shared";
import { Text } from "@react-three/drei";
import { Avatar, shirtFromAppearance, pantsFromAppearance } from "./Avatar";

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
  const pants = pantsFromAppearance(appearance, player.name?.length || 1);

  return (
    <group ref={group} position={[player.position.x, player.position.y, player.position.z]}>
      <Avatar appearance={appearance} shirtColor={shirt} pantsColor={pants} animation={player.animation || "idle"} showFace />
      {/* Nameplate — larger + soft glow so other players are easy to spot */}
      <Text
        position={[0, 2.45, 0]}
        fontSize={0.36}
        color="#fff8e7"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#000000"
      >
        {player.name}
      </Text>
      <mesh position={[0, 2.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 12]} />
        <meshBasicMaterial color="#55efc4" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

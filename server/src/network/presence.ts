import type { Server } from "socket.io";
import type { Vec3, CharacterAppearance, PublicCharacter } from "@life-sim/shared";
import { Bucket } from "../util/rateLimit";

export interface PlayerSession {
  socketId: string;
  characterId: string;
  userId: string;
  name: string;
  appearance: CharacterAppearance;
  cityKey: string;
  position: Vec3;
  rotation: number;
  animation: string;
  lastUpdate: number;
  lastMoveAt: number;
  /** Distance the player is currently allowed to cover (leaky bucket → caps speed). */
  moveBudget: number;
  lastRubberband: number;
  dirty: boolean;
  /** Server-owned jump timeline prevents clients from setting arbitrary airborne heights. */
  jumpStartedAt: number;
  jumpUntil: number;
  nextJumpAt: number;
  chatBucket: Bucket;
}

/** Online players by characterId. Lives in its own module so services can read it without import cycles. */
export const onlinePlayers = new Map<string, PlayerSession>();

let ioRef: Server | null = null;
export function setIo(io: Server) {
  ioRef = io;
}

export const cityRoom = (cityKey: string) => `city:${cityKey}`;

export function toPublic(s: PlayerSession): PublicCharacter {
  return {
    id: s.characterId,
    name: s.name,
    appearance: s.appearance,
    position: s.position,
    rotation: s.rotation,
    animation: s.animation,
    isOnline: true,
  };
}

/** Where the player really is right now (the DB copy is only flushed every few seconds). */
export function getLivePosition(characterId: string): { x: number; z: number } | null {
  const s = onlinePlayers.get(characterId);
  return s ? { x: s.position.x, z: s.position.z } : null;
}

/**
 * Server-authoritative move: used after travel / spawn changes so the movement checks
 * and every client agree about where the player is.
 */
export function relocatePlayer(characterId: string, cityKey: string, x: number, z: number) {
  const s = onlinePlayers.get(characterId);
  if (!s || !ioRef) return;
  const sock = ioRef.sockets.sockets.get(s.socketId);

  if (s.cityKey !== cityKey) {
    ioRef.to(cityRoom(s.cityKey)).except(s.socketId).emit("player_left", { playerId: s.characterId });
    sock?.leave(cityRoom(s.cityKey));
    s.cityKey = cityKey;
    sock?.join(cityRoom(cityKey));
    const others: PublicCharacter[] = [];
    for (const p of onlinePlayers.values()) {
      if (p.characterId !== characterId && p.cityKey === cityKey) others.push(toPublic(p));
    }
    ioRef.to(s.socketId).emit("players_list", others);
  }

  s.position = { x, y: 0, z };
  s.jumpStartedAt = 0;
  s.jumpUntil = 0;
  s.nextJumpAt = Date.now() + 850;
  s.moveBudget = 0;
  s.lastMoveAt = Date.now();
  s.dirty = true;
  ioRef.to(s.socketId).emit("teleport", s.position);
  // (re)announce to the destination city
  ioRef.to(cityRoom(cityKey)).except(s.socketId).emit("player_joined", toPublic(s));
}

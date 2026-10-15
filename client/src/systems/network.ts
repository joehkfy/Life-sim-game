import { io, Socket } from "socket.io-client";
import { useGameStore } from "../stores/gameStore";
import type { FullCharacter, PublicCharacter, Vec3 } from "@life-sim/shared";

let socket: Socket | null = null;

const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;

export function connectSocket(token: string) {
  if (socket?.connected) return;

  socket = io(SERVER_URL, {
    autoConnect: true,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    console.log("[Network] Connected");
    socket?.emit("auth", token);
  });

  socket.on("auth_ok", (data: { character: FullCharacter }) => {
    useGameStore.getState().setCharacter(data.character);
  });

  socket.on("auth_error", (data: { message: string }) => {
    console.error("[Network] Auth error:", data.message);
    useGameStore.getState().logout();
  });

  socket.on("players_list", (players: PublicCharacter[]) => {
    useGameStore.getState().setPlayersList(players);
  });

  socket.on("player_joined", (player: PublicCharacter) => {
    useGameStore.getState().addPlayer(player);
  });

  socket.on("player_left", (data: { playerId: string }) => {
    useGameStore.getState().removePlayer(data.playerId);
  });

  socket.on("player_update", (data: {
    playerId: string;
    position: Vec3;
    rotation: number;
    animation: string;
  }) => {
    useGameStore.getState().updatePlayer(data.playerId, {
      position: data.position,
      rotation: data.rotation,
      animation: data.animation,
    });
  });

  socket.on("chat", (msg: {
    fromId: string;
    fromName: string;
    content: string;
    timestamp: number;
  }) => {
    useGameStore.getState().addChat(msg);
  });

  socket.on("world_time", (data: { time: number; day: number; weather: string }) => {
    useGameStore.getState().setWorldTime(data.time, data.day, data.weather);
  });

  socket.on("teleport", (pos: Vec3) => {
    useGameStore.getState().setTeleport(pos);
  });

  socket.on("disconnect", () => {
    console.log("[Network] Disconnected");
  });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function sendMove(position: Vec3, rotation: number, animation: string) {
  socket?.emit("move", { position, rotation, animation });
}

export function sendChat(content: string, channel: "nearby" | "private" = "nearby", targetId?: string) {
  socket?.emit("chat", { channel, content, targetId });
}

export function getSocket() {
  return socket;
}

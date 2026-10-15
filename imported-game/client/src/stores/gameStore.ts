import { create } from "zustand";
import type { FullCharacter, PublicCharacter } from "@life-sim/shared";

interface GameState {
  token: string | null;
  user: { id: string; username: string; email: string } | null;
  character: FullCharacter | null;
  otherPlayers: Map<string, PublicCharacter>;
  worldTime: number;
  worldDay: number;
  weather: string;
  chatMessages: { fromId: string; fromName: string; content: string; timestamp: number }[];
  screen: "auth" | "create" | "game";
  teleport: { x: number; y: number; z: number } | null;
  setTeleport: (p: { x: number; y: number; z: number }) => void;
  clearTeleport: () => void;

  setAuth: (token: string, user: { id: string; username: string; email: string }, hasCharacter: boolean) => void;
  setCharacter: (character: FullCharacter) => void;
  setScreen: (screen: "auth" | "create" | "game") => void;
  logout: () => void;

  addPlayer: (player: PublicCharacter) => void;
  removePlayer: (id: string) => void;
  updatePlayer: (id: string, data: Partial<PublicCharacter>) => void;
  setPlayersList: (players: PublicCharacter[]) => void;

  setWorldTime: (time: number, day: number, weather: string) => void;
  addChat: (msg: { fromId: string; fromName: string; content: string; timestamp: number }) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  token: localStorage.getItem("life-sim-token"),
  user: null,
  character: null,
  otherPlayers: new Map(),
  worldTime: 8,
  worldDay: 1,
  weather: "sunny",
  chatMessages: [],
  screen: "auth",
  teleport: null,
  setTeleport: (p) => set({ teleport: p }),
  clearTeleport: () => set({ teleport: null }),

  setAuth: (token, user, hasCharacter) => {
    localStorage.setItem("life-sim-token", token);
    set({
      token,
      user,
      screen: hasCharacter ? "game" : "create",
    });
  },

  setCharacter: (character) => set({ character, screen: "game" }),

  setScreen: (screen) => set({ screen }),

  logout: () => {
    localStorage.removeItem("life-sim-token");
    set({
      token: null,
      user: null,
      character: null,
      otherPlayers: new Map(),
      chatMessages: [],
      screen: "auth",
    });
  },

  addPlayer: (player) => {
    const map = new Map(get().otherPlayers);
    map.set(player.id, player);
    set({ otherPlayers: map });
  },

  removePlayer: (id) => {
    const map = new Map(get().otherPlayers);
    map.delete(id);
    set({ otherPlayers: map });
  },

  updatePlayer: (id, data) => {
    const map = new Map(get().otherPlayers);
    const existing = map.get(id);
    if (existing) {
      map.set(id, { ...existing, ...data });
      set({ otherPlayers: map });
    }
  },

  setPlayersList: (players) => {
    const map = new Map<string, PublicCharacter>();
    players.forEach((p) => map.set(p.id, p));
    set({ otherPlayers: map });
  },

  setWorldTime: (time, day, weather) => set({ worldTime: time, worldDay: day, weather }),

  addChat: (msg) => {
    const msgs = [...get().chatMessages, msg].slice(-50);
    set({ chatMessages: msgs });
  },
}));

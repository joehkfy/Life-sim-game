// Shared types between client and server

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CharacterAppearance {
  skinTone: number;
  hairStyle: number;
  hairColor: string;
  facePreset: number;
  clothingTop: number;
  clothingBottom: number;
  accessories: number[];
}

export interface CharacterStats {
  energy: number;
  hunger: number;
  happiness: number;
  hygiene: number;
  health: number;
  money: number;
  bankBalance: number;
}

export interface CharacterSkills {
  intelligence: number;
  strength: number;
  charisma: number;
  creativity: number;
  cooking: number;
  fitness: number;
}

export type RelationshipType =
  | "stranger"
  | "acquaintance"
  | "friend"
  | "close_friend"
  | "rival"
  | "classmate"
  | "coworker"
  | "family"
  | "romantic";

export interface PublicCharacter {
  id: string;
  name: string;
  appearance: CharacterAppearance;
  position: Vec3;
  rotation: number;
  animation: string;
  isOnline: boolean;
}

export interface InventoryItem {
  id: string;
  itemKey: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}

export interface EquippedItems {
  top?: string;
  bottom?: string;
  accessory?: string;
}

export interface FullCharacter extends PublicCharacter {
  userId: string;
  age: number;
  lifeStage: string;
  countryCode: string;
  stateCode: string;
  cityKey: string;
  personality: string;
  stats: CharacterStats;
  skills: CharacterSkills;
  jobId: string | null;
  jobLevel: number;
  jobXp: number;
  educationLevel: string;
  homeId: string | null;
  location: string;
  inventory: InventoryItem[];
  equipped: EquippedItems;
  createdAt: string;
  lastLogin: string;
}

export interface ItemDef {
  key: string;
  name: string;
  description: string;
  category: "food" | "clothing" | "furniture" | "tool" | "misc";
  price: number;
  stackable: boolean;
  maxStack: number;
  effects: Partial<CharacterStats> & Record<string, number>;
  slot?: "top" | "bottom" | "accessory";
  icon: string;
}

export interface ShopDef {
  key: string;
  name: string;
  description: string;
  location: string;
  posX: number;
  posY: number;
  posZ: number;
  itemKeys: string[];
}

export interface JobDef {
  id: string;
  name: string;
  description: string;
  basePay: number;
  requirements: Partial<CharacterSkills>;
  schedule: { start: number; end: number };
  location: string;
  maxLevel: number;
}

// ========== Network ==========

export type ClientMessage =
  | { type: "auth"; token: string }
  | { type: "move"; position: Vec3; rotation: number; animation: string }
  | { type: "chat"; channel: "nearby" | "private"; content: string; targetId?: string }
  | { type: "interact"; targetId: string; action: string }
  | { type: "request_nearby" };

export type ServerMessage =
  | { type: "auth_ok"; character: FullCharacter }
  | { type: "auth_error"; message: string }
  | { type: "player_joined"; player: PublicCharacter }
  | { type: "player_left"; playerId: string }
  | { type: "player_update"; playerId: string; position: Vec3; rotation: number; animation: string }
  | { type: "chat"; fromId: string; fromName: string; channel: string; content: string; timestamp: number }
  | { type: "world_time"; time: number; day: number; weather: string }
  | { type: "notification"; message: string; level: "info" | "success" | "warning" | "error" }
  | { type: "character_update"; character: Partial<FullCharacter> }
  | { type: "error"; message: string };

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: { id: string; username: string; email: string };
  hasCharacter: boolean;
}

export interface CreateCharacterRequest {
  name: string;
  appearance: CharacterAppearance;
  personality: string;
  countryCode?: string;
  stateCode?: string;
  cityKey?: string;
  lifeStage?: "child" | "adult";
  age?: number;
}

export const WORLD = {
  TICK_RATE: 20,
  MOVE_SPEED: 5,
  RUN_SPEED: 9,
  INTERACT_RANGE: 4,
  CHAT_RANGE: 25,
  SYNC_DISTANCE: 80,
} as const;

export const STATS = {
  MAX: 100,
  ENERGY_DECAY_PER_HOUR: 8,
  HUNGER_DECAY_PER_HOUR: 6,
  HAPPINESS_DECAY_PER_HOUR: 3,
} as const;

// Building interaction points (city world positions)
export const BUILDINGS = {
  shop: { key: "shop", name: "General Store", x: -18, z: 15, radius: 5 },
  restaurant: { key: "restaurant", name: "Restaurant", x: 18, z: 12, radius: 5 },
  school: { key: "school", name: "School", x: -25, z: -20, radius: 7 },
  university: { key: "university", name: "University", x: 30, z: -25, radius: 8 },
  hospital: { key: "hospital", name: "Hospital", x: -30, z: 25, radius: 6 },
  police: { key: "police", name: "Police Station", x: 25, z: 28, radius: 5 },
  gym: { key: "gym", name: "Gym", x: -22, z: -5, radius: 5 },
  apartments: { key: "apartments", name: "Apartments", x: 20, z: -8, radius: 6 },
  park: { key: "park", name: "Central Park", x: 0, z: 0, radius: 0 }, // not enterable
} as const;

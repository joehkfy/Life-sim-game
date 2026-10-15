import { Server, Socket } from "socket.io";
import { Prisma } from "@prisma/client";
import { verifyToken } from "../auth/auth";
import { getCharacterByUserId } from "../game/player/characterService";
import type { PublicCharacter } from "@life-sim/shared";
import { prisma } from "../db/client";
import { areFriends, savePrivateMessage } from "../game/social/friendsService";
import { resolveDueCompetitions } from "../game/competition/competitionService";
import { Bucket } from "../util/rateLimit";
import { onlinePlayers, setIo, cityRoom, toPublic, type PlayerSession } from "./presence";

// ---- tuning ----
const RUN_SPEED = 9; // must match the client's RUN_SPEED
const MAX_SPEED = Math.max(RUN_SPEED * 1.5, 36); // sustained m/s: allows the fastest vehicle (32) plus lag slack
const MAX_BURST = 8; // metres we allow after a long gap (e.g. a lag spike)
const WORLD_LIMIT = 1500; // starter-home streets extend east as more players join
const NEARBY_RADIUS = 40;
const ANIMATIONS = new Set([
  "idle", "walk", "run", "sleep", "waking", "stand_up", "relax", "watch_tv", "watch_tv_sit",
  "get_snack", "cook", "shower", "work_on_computer", "read", "sit", "phone", "phone_typing",
  "wave", "jump", "land", "crouch", "drink", "open_door", "reach", "pick_up", "pickup",
  "carry", "put_down", "talk", "laugh", "clap", "shrug", "point", "handshake", "fist_bump",
  "celebrate", "stretch", "yawn", "nod", "shake_head", "look_at", "idle_holding",
  "dance", "wash_hands", "brush_teeth", "kneel",
]);
const AUTH_TIMEOUT_MS = 10_000;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

let intervals: NodeJS.Timeout[] = [];
let gameTime = 8;
let day = 1;
let weather = "sunny";

/** Shared deterministic weather so every connected player sees the same conditions.
 * Weather changes in six-game-hour blocks (roughly ten real minutes at the current clock speed).
 */
function weatherFor(dayNumber: number, hour: number): string {
  const block = Math.floor(hour / 6);
  const sample = ((dayNumber * 73 + block * 37 + dayNumber * block * 19) % 100 + 100) % 100;
  if (sample < 43) return "sunny";
  if (sample < 70) return "cloudy";
  if (sample < 93) return "rainy";
  return "stormy";
}

export function setupSocketHandlers(io: Server) {
  setIo(io);

  io.on("connection", (socket: Socket) => {
    let session: PlayerSession | null = null;
    const moveBucket = new Bucket(60, 40); // ≤ ~40 move messages / second (client sends 20)
    let authStarted = false;

    // Sockets that never authenticate are dropped.
    const authTimer = setTimeout(() => {
      if (!session) socket.disconnect(true);
    }, AUTH_TIMEOUT_MS);

    socket.on("auth", async (token: unknown) => {
      if (authStarted || typeof token !== "string") return;
      authStarted = true;
      try {
        const { userId } = verifyToken(token);
        const character = await getCharacterByUserId(userId);
        if (!character) {
          socket.emit("auth_error", { message: "No character found. Create one first." });
          return;
        }

        const existing = onlinePlayers.get(character.id);
        if (existing) {
          io.to(existing.socketId).emit("error", { message: "Logged in from another place" });
          io.sockets.sockets.get(existing.socketId)?.disconnect(true);
        }

        const now = Date.now();
        const s: PlayerSession = {
          socketId: socket.id,
          characterId: character.id,
          userId,
          name: character.name,
          appearance: character.appearance,
          cityKey: character.cityKey || "starter",
          position: { ...character.position },
          rotation: character.rotation,
          animation: "idle",
          lastUpdate: now,
          lastMoveAt: now,
          moveBudget: MAX_BURST,
          lastRubberband: 0,
          dirty: false,
          jumpStartedAt: 0,
          jumpUntil: 0,
          nextJumpAt: now,
          chatBucket: new Bucket(5, 1), // 5 messages burst, then 1/sec
        };
        session = s;
        onlinePlayers.set(character.id, s);
        clearTimeout(authTimer);

        socket.join("world"); // global broadcasts (clock)
        socket.join(cityRoom(s.cityKey)); // everything spatial is per-city

        socket.emit("auth_ok", { character });

        const others: PublicCharacter[] = [];
        for (const p of onlinePlayers.values()) {
          if (p.characterId !== s.characterId && p.cityKey === s.cityKey) others.push(toPublic(p));
        }
        socket.emit("players_list", others);
        socket.to(cityRoom(s.cityKey)).emit("player_joined", toPublic(s));

        console.log(`[Socket] ${s.name} joined ${s.cityKey} (${onlinePlayers.size} online)`);
      } catch (err: any) {
        authStarted = false;
        socket.emit("auth_error", { message: err?.message || "Authentication failed" });
      }
    });

    socket.on("move", (data: { position?: { x?: unknown; y?: unknown; z?: unknown }; rotation?: unknown; animation?: unknown }) => {
      const s = session;
      if (!s || !data || !data.position) return;
      if (!moveBucket.take()) return;

      const { x, z } = data.position;
      if (!isNum(x) || !isNum(z) || !isNum(data.rotation)) return;
      if (Math.abs(x) > WORLD_LIMIT || Math.abs(z) > WORLD_LIMIT) return;

      const now = Date.now();
      const dt = Math.min((now - s.lastMoveAt) / 1000, 2);
      s.lastMoveAt = now;
      // Leaky bucket of distance: sustained speed can never exceed MAX_SPEED, however fast messages are sent.
      s.moveBudget = Math.min(MAX_BURST, s.moveBudget + dt * MAX_SPEED);

      const dist = Math.hypot(x - s.position.x, z - s.position.z);
      if (dist > s.moveBudget) {
        // Too fast: snap the client back (at most twice a second).
        if (now - s.lastRubberband > 500) {
          s.lastRubberband = now;
          socket.emit("teleport", s.position);
        }
        return;
      }
      s.moveBudget -= dist;

      const requestedAnimation = typeof data.animation === "string" && ANIMATIONS.has(data.animation) ? data.animation : "idle";
      // The server owns the jump curve; clients cannot spoof height or hover by
      // sending arbitrary Y values. Start once per jump edge, then evaluate the
      // same smooth sine arc regardless of packet timing.
      if (requestedAnimation === "jump" && s.animation !== "jump" && now >= s.nextJumpAt) {
        s.jumpStartedAt = now;
        s.jumpUntil = now + 620;
        s.nextJumpAt = now + 850;
      }
      const airborne = now < s.jumpUntil && (requestedAnimation === "jump" || requestedAnimation === "land");
      const jumpProgress = airborne ? Math.max(0, Math.min(1, (now - s.jumpStartedAt) / 620)) : 0;
      const y = airborne ? Math.sin(jumpProgress * Math.PI) * 0.78 : 0;
      s.position = { x, y, z };
      s.rotation = data.rotation;
      s.animation = requestedAnimation;
      s.lastUpdate = now;
      s.dirty = true;

      socket.to(cityRoom(s.cityKey)).emit("player_update", {
        playerId: s.characterId,
        position: s.position,
        rotation: s.rotation,
        animation: s.animation,
      });
    });

    socket.on("chat", async (data: { channel?: unknown; content?: unknown; targetId?: unknown }) => {
      const s = session;
      if (!s || !data || typeof data.content !== "string") return;
      const content = data.content.trim().slice(0, 300);
      if (!content) return;
      if (!s.chatBucket.take()) {
        socket.emit("notification", { message: "You're sending messages too fast", level: "warning" });
        return;
      }

      const payload = {
        fromId: s.characterId,
        fromName: s.name,
        channel: data.channel,
        content,
        timestamp: Date.now(),
        targetId: typeof data.targetId === "string" ? data.targetId : undefined,
      };

      if (data.channel === "nearby") {
        // Only people in the same city and within earshot (it used to go to every player in the world).
        for (const p of onlinePlayers.values()) {
          if (p.cityKey !== s.cityKey) continue;
          if (Math.hypot(p.position.x - s.position.x, p.position.z - s.position.z) <= NEARBY_RADIUS) {
            io.to(p.socketId).emit("chat", payload);
          }
        }
      } else if (data.channel === "private" && typeof data.targetId === "string") {
        try {
          if (!(await areFriends(s.characterId, data.targetId))) {
            socket.emit("notification", { message: "You can only message friends", level: "warning" });
            return;
          }
          await savePrivateMessage(s.characterId, data.targetId, content);
        } catch (e) {
          console.error("Failed to save PM", e);
          return;
        }
        const target = onlinePlayers.get(data.targetId);
        if (target) io.to(target.socketId).emit("chat", payload);
        socket.emit("chat", payload);
      }
    });

    socket.on("interact", (data: { action?: unknown }) => {
      if (!session) return;
      socket.emit("notification", { message: `Interaction "${String(data?.action ?? "").slice(0, 40)}" received (coming soon)`, level: "info" });
    });

    socket.on("disconnect", async () => {
      clearTimeout(authTimer);
      const s = session;
      if (!s) return;
      // If this player logged in elsewhere, the NEW session owns the entry — don't delete it.
      if (onlinePlayers.get(s.characterId)?.socketId !== s.socketId) return;

      onlinePlayers.delete(s.characterId);
      socket.to(cityRoom(s.cityKey)).emit("player_left", { playerId: s.characterId });
      await persistPosition(s);
      console.log(`[Socket] ${s.name} left (${onlinePlayers.size} online)`);
    });
  });

  startBackgroundJobs(io);
}

async function persistPosition(s: PlayerSession) {
  try {
    await prisma.character.update({
      where: { id: s.characterId },
      data: { posX: s.position.x, posY: 0, posZ: s.position.z, rotationY: s.rotation, lastLogin: new Date() },
    });
    s.dirty = false;
  } catch (e) {
    console.error("Failed to save position", e);
  }
}

/** Positions only lived in memory until disconnect, so every "are you near X" check read stale data. */
async function flushPositions() {
  const dirty = Array.from(onlinePlayers.values()).filter((s) => s.dirty);
  await Promise.all(dirty.map((s) => persistPosition(s)));
}

async function saveWorldState() {
  try {
    await prisma.worldState.update({ where: { id: "global" }, data: { gameTime, day, weather } });
  } catch (e) {
    console.error("Failed to save world state", e);
  }
}

function startBackgroundJobs(io: Server) {
  prisma.worldState
    .findUnique({ where: { id: "global" } })
    .then((ws) => {
      if (ws) {
        gameTime = ws.gameTime;
        day = ws.day;
        weather = typeof ws.weather === "string" && ws.weather.length ? ws.weather : weatherFor(day, gameTime);
      }
      // Re-derive the block's weather after loading so stale values cannot persist
      // indefinitely when a server is restarted in the middle of a weather period.
      weather = weatherFor(day, gameTime);
    })
    .catch(() => {});

  // World clock: 4s real = 0.04 game hours. Saved once a minute.
  let ticks = 0;
  intervals.push(
    setInterval(() => {
      gameTime += 0.04;
      if (gameTime >= 24) {
        gameTime -= 24;
        day += 1;
      }
      weather = weatherFor(day, gameTime);
      io.to("world").emit("world_time", { time: gameTime, day, weather });
      ticks += 1;
      if (ticks % 15 === 0) void saveWorldState();
    }, 4000)
  );

  // Needs decay for online players — ONE atomic UPDATE instead of read+write per player
  // (the old read-modify-write could also overwrite a work shift's energy/hunger changes).
  intervals.push(
    setInterval(async () => {
      const ids = Array.from(onlinePlayers.keys());
      if (ids.length === 0) return;
      try {
        await prisma.$executeRaw`
          UPDATE characters
          SET energy = GREATEST(0, energy - 1.5),
              hunger = LEAST(100, hunger + 1.2),
              happiness = GREATEST(0, happiness - 0.4),
              hygiene = GREATEST(0, hygiene - 0.8)
          WHERE id IN (${Prisma.join(ids)})`;
      } catch (e) {
        console.error("Needs decay failed", e);
      }
    }, 60_000)
  );

  intervals.push(setInterval(() => void flushPositions(), 5000));

  // Close competition rounds whose time is up (pays the winner, reopens the round).
  intervals.push(setInterval(() => void resolveDueCompetitions(), 30_000));
}

/** Called on SIGTERM/SIGINT so a deploy or restart doesn't lose progress. */
export async function shutdownSockets() {
  for (const i of intervals) clearInterval(i);
  intervals = [];
  await flushPositions();
  await saveWorldState();
}

export function getOnlinePlayers() {
  return onlinePlayers;
}

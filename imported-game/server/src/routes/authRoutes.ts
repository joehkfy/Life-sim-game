import { Router } from "express";
import type { Request, Response } from "express";
import { register, login, verifyToken } from "../auth/auth";
import { createCharacter, getCharacterByUserId } from "../game/player/characterService";
import { GameError } from "../util/errors";
import { rateLimit } from "../util/rateLimit";
import { parse, registerSchema, loginSchema, characterSchema } from "../util/validation";
import type { CreateCharacterRequest } from "@life-sim/shared";

const router = Router();

// Brute-force protection: per IP, and per target email for logins.
const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 40, message: "Too many attempts. Try again in a few minutes." });
const loginEmailLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  message: "Too many login attempts for this account. Try again in a few minutes.",
  key: (req) => `login:${String(req.body?.email || "").toLowerCase().slice(0, 120)}`,
});

function userIdFrom(req: Request): string {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new GameError("No token", 401);
  return verifyToken(header.slice(7)).userId;
}

function send(res: Response, e: unknown, fallbackStatus = 400) {
  if (e instanceof GameError) return res.status(e.status).json({ error: e.message });
  console.error("[auth route]", e);
  return res.status(500).json({ error: "Something went wrong" });
}

router.post("/register", authLimiter, async (req, res) => {
  try {
    res.json(await register(parse(registerSchema, req.body)));
  } catch (e) {
    send(res, e);
  }
});

router.post("/login", authLimiter, loginEmailLimiter, async (req, res) => {
  try {
    res.json(await login(parse(loginSchema, req.body)));
  } catch (e) {
    send(res, e);
  }
});

router.get("/me", async (req, res) => {
  try {
    const character = await getCharacterByUserId(userIdFrom(req));
    res.json({ hasCharacter: !!character, character });
  } catch (e) {
    send(res, e);
  }
});

router.post("/character", async (req, res) => {
  try {
    const userId = userIdFrom(req);
    const data = parse(characterSchema, req.body) as CreateCharacterRequest;
    res.json(await createCharacter(userId, data));
  } catch (e) {
    send(res, e);
  }
});

export default router;

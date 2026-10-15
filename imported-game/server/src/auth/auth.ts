import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db/client";
import { GameError } from "../util/errors";
import { isUniqueViolation } from "../util/db";
import type { RegisterRequest, LoginRequest, AuthResponse } from "@life-sim/shared";

const JWT_EXPIRES = "7d";

const JWT_SECRET: string = (() => {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set to a random string of 16+ characters in production");
  }
  console.warn("[auth] JWT_SECRET missing/short — using an insecure dev secret. Never do this in production.");
  return "dev-secret-change-me-not-for-production";
})();

// Used so a login for an unknown email takes as long as a real one (no timing leak).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

function isConfiguredAdminEmail(email: string): boolean {
  const allowlist = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

function sign(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: "HS256", expiresIn: JWT_EXPIRES });
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const username = data.username.toLowerCase();
  const email = data.email.toLowerCase();

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (existing) throw new GameError("Username or email already taken");

  const passwordHash = await bcrypt.hash(data.password, 12);

  let user;
  try {
    user = await prisma.user.create({ data: { username, email, passwordHash, isAdmin: isConfiguredAdminEmail(email) } });
  } catch (e) {
    if (isUniqueViolation(e)) throw new GameError("Username or email already taken");
    throw e;
  }

  return {
    token: sign(user.id),
    user: { id: user.id, username: user.username, email: user.email },
    hasCharacter: false,
  };
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
    include: { character: true },
  });

  const valid = await bcrypt.compare(data.password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !valid) throw new GameError("Invalid email or password", 401);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLogin: new Date(),
      // Allows an existing account to receive the configured admin role after
      // ADMIN_EMAILS is added, without exposing any client-controlled role field.
      ...(isConfiguredAdminEmail(user.email) ? { isAdmin: true } : {}),
    },
  });

  return {
    token: sign(user.id),
    user: { id: user.id, username: user.username, email: user.email },
    hasCharacter: !!user.character,
  };
}

export function verifyToken(token: string): { userId: string } {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as { userId?: string };
    if (!payload.userId) throw new Error("bad payload");
    return { userId: payload.userId };
  } catch {
    throw new GameError("Invalid or expired token", 401);
  }
}

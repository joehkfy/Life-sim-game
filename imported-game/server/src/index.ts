import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { createServer } from "http";
import { Server } from "socket.io";
import authRoutes from "./routes/authRoutes";
import gameRoutes from "./routes/gameRoutes";
import { setupSocketHandlers, shutdownSockets } from "./network/socketHandler";
import { prisma } from "./db/client";
import { GameError } from "./util/errors";
import { ensureCourses } from "./game/school/schoolService";
import { ensureDefaultCompetitions } from "./game/competition/competitionService";

const PORT = parseInt(process.env.PORT || "3001", 10);
const IS_PROD = process.env.NODE_ENV === "production";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

/**
 * Browser origins allowed to call the API. Replit's own domains are added automatically,
 * so it works on Replit without setting CLIENT_URL. Several origins: CLIENT_URL="https://a.com,https://b.com".
 */
function allowedOrigins(): string[] {
  const list = CLIENT_URL.split(",").map((s) => s.trim()).filter(Boolean);
  const replit = [process.env.REPLIT_DEV_DOMAIN, ...(process.env.REPLIT_DOMAINS || "").split(",")]
    .map((d) => (d || "").trim())
    .filter(Boolean)
    .map((d) => `https://${d}`);
  return Array.from(new Set([...list, ...replit]));
}

async function main() {
  await prisma.worldState.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global", gameTime: 8, day: 1, weather: "sunny" },
  });
  // Static game content is created once at start-up (not on every page view).
  await ensureCourses();
  await ensureDefaultCompetitions();

  const origins = allowedOrigins();
  const corsOrigin = (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) =>
    // No Origin header = same-origin request or a non-browser client (the built client is served from here).
    cb(null, !origin || origins.includes(origin));

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Replit and most hosts sit behind one proxy - needed for per-IP rate limits

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: "20kb" }));

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", db: "up", time: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: "degraded", db: "down", time: new Date().toISOString() });
    }
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/game", gameRoutes);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  // Production: the server also serves the built client (one port, which is what Replit deployments expect).
  const clientDist = path.resolve(__dirname, "../../client/dist");
  if (fs.existsSync(path.join(clientDist, "index.html"))) {
    app.use(
      express.static(clientDist, {
        maxAge: IS_PROD ? "1h" : 0,
        setHeaders: (res, file) => {
          // Hashed build assets can be cached for a long time; index.html must always be fresh.
          if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        },
      })
    );
    app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  } else {
    app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  }

  // Final safety net (bad JSON bodies, unexpected throws) - never leak internals.
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof GameError) return res.status(err.status).json({ error: err.message });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request too large" });
    console.error("[server] unhandled error", err);
    res.status(500).json({ error: "Something went wrong" });
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin as any, methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e5,
  });

  setupSocketHandlers(io);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\nLife Sim server running on port ${PORT}`);
    console.log(`  Health:  http://localhost:${PORT}/health`);
    console.log(`  Origins: ${origins.join(", ") || "(same-origin only)"}\n`);
  });

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    console.log(`\n[server] ${signal} received, saving state...`);
    try {
      await shutdownSockets();
      io.close();
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

process.on("unhandledRejection", (reason) => {
  console.error("[server] unhandledRejection", reason);
});

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

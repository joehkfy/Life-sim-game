import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../auth/auth";
import { prisma } from "../db/client";
import { getCharacterByUserId, createCharacter } from "../game/player/characterService";
import { ITEM_CATALOG } from "../game/items/catalog";
import { getInventory, buyItem, useItem, equipItem } from "../game/economy/inventoryService";
import { listJobs, applyForJob, quitJob, workShift } from "../game/jobs/jobService";
import {
  sendFriendRequest,
  respondFriendRequest,
  listFriends,
  listPendingRequests,
  removeFriend,
  searchPlayers,
  getPrivateMessages,
} from "../game/social/friendsService";
import { deposit, withdraw, transfer, getBank, recentTransactions } from "../game/bank/bankService";
import {
  enterBuilding,
  exitToCity,
  listProperties,
  rentProperty,
  buyProperty,
  leaveHome,
} from "../game/world/buildingService";
import {
  listCountries,
  listStatesByCountry,
  listCitiesByState,
  listCitiesByCountry,
  getWorldSummary,
  getCity,
  listPlots,
  listCityBuildings,
  listCityHomes,
  buyPlot,
  myBuildings,
  BUILDING_TYPES,
} from "../game/world/worldService";
import {
  getHomeFurniture,
  placeFurniture,
  moveFurniture,
  removeFurniture,
  interactWithFurniture,
  FURNITURE_CATALOG,
} from "../game/world/homeService";
import {
  listBusinessTypes,
  listBusinesses,
  myBusinesses,
  openBusiness,
  postJob,
  applyToBusiness,
  workBusinessShift,
  buyFromBusiness,
  restockProduct,
  setBusinessOpen,
  withdrawBusiness,
  myEmployment,
  quitBusinessJob,
} from "../game/business/businessService";
import { listCatalog as vehicleCatalog, myVehicles, buyVehicle, driveVehicle } from "../game/vehicles/vehicleService";
import { listCourses, myProgress, attendCourse } from "../game/school/schoolService";
import { listCompetitions, enterCompetition, resolveCompetition, leaderboards } from "../game/competition/competitionService";
import { chatWithNpc, getResidentIdentity, normalizeResidentActivity } from "../game/npc/npcDialogueService";
import { travelToCity, takeRoute, getTravelOptions, listAirports, listStations } from "../game/world/travelService";
import {
  startConstruction,
  cancelConstruction,
  acceptRole,
  workConstruction,
  listOpenProjects,
  getProject,
  myConstructionWork,
  listWorkersByTrade,
  CONSTRUCTION_ROLES,
} from "../game/world/constructionService";
import { listNotifications, markRead, unreadCount } from "../game/social/notificationService";
import { listMarket, createListing, buyListing, cancelListing } from "../game/economy/marketService";
import { GameError } from "../util/errors";
import { rateLimit } from "../util/rateLimit";
import { parse, body, query, idSchema, keySchema, characterSchema } from "../util/validation";

const router = Router();

type AuthedReq = Request & { userId: string };

function auth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });
    (req as AuthedReq).userId = verifyToken(header.slice(7)).userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Per-player limits (after auth so the key is the user, not a shared IP).
const generalLimit = rateLimit({
  windowMs: 60_000,
  max: 240,
  key: (req) => `g:${(req as AuthedReq).userId}`,
});
const actionLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  message: "You're doing that too fast",
  key: (req) => `a:${(req as AuthedReq).userId}`,
});
const npcChatLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: "You're chatting too quickly. Try again in a moment.",
  key: (req) => `npc:${(req as AuthedReq).userId}`,
});

/** Wraps a handler: GameError -> its status/message, anything else -> logged + generic 500. */
function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (e: any) {
      if (e instanceof GameError) return res.status(e.status).json({ error: e.message });
      console.error(`[route] ${req.method} ${req.path}`, e);
      res.status(500).json({ error: "Something went wrong" });
    }
  };
}

// ---- Public world browsing (read-only; the character creator calls these) ----
const publicLimit = rateLimit({ windowMs: 60_000, max: 90, message: "Too many requests, slow down" });

router.get("/world/countries", publicLimit, handle(async (_req, res) => {
  res.json(await listCountries());
}));
router.get("/world/states", publicLimit, handle(async (req, res) => {
  const country = parse(query.country, req.query.country);
  res.json(country ? await listStatesByCountry(country) : []);
}));
router.get("/world/cities", publicLimit, handle(async (req, res) => {
  const country = parse(query.country, req.query.country);
  const state = parse(query.stateCode, req.query.state);
  if (country && state) return res.json(await listCitiesByState(country, state));
  res.json(await listCitiesByCountry(country));
}));
router.get("/world/summary", publicLimit, handle(async (_req, res) => {
  res.json(await getWorldSummary());
}));

router.use(auth, generalLimit);

async function charId(req: Request) {
  const c = await prisma.character.findUnique({ where: { userId: (req as AuthedReq).userId }, select: { id: true } });
  if (!c) throw new GameError("No character");
  return c.id;
}


// ---- Character ----
router.get("/character", handle(async (req, res) => {
  const character = await getCharacterByUserId((req as AuthedReq).userId);
  if (!character) return res.status(404).json({ error: "No character" });
  res.json(character);
}));

// AI NPC dialogue is server-side so the Groq API key is never exposed to the browser.
router.post("/npc/chat", npcChatLimit, handle(async (req, res) => {
  const input = parse(body.npcChat, req.body);
  const identity = getResidentIdentity(input.residentId);
  if (!identity) throw new GameError("Resident not found", 404);

  const character = await prisma.character.findUnique({
    where: { userId: (req as AuthedReq).userId },
    select: { name: true, age: true, personality: true, location: true, cityKey: true },
  });
  if (!character) throw new GameError("Create a character before talking to residents");
  if (character.location !== "city") throw new GameError("Step outside before talking to residents");
  const world = await prisma.worldState.findUnique({ where: { id: "global" }, select: { gameTime: true, weather: true } });

  // Resident identity, city, time, and weather come from server-controlled data where possible.
  // Never let arbitrary client labels become part of the system prompt.
  res.json(await chatWithNpc({
    ...input,
    residentName: identity.name,
    residentRole: identity.role,
    activity: normalizeResidentActivity(input.activity, identity.role),
    cityKey: character.cityKey || "starter",
    worldTime: world?.gameTime ?? 8,
    weather: world?.weather ?? "sunny",
    player: character,
  }));
}));

router.post("/character", actionLimit, handle(async (req, res) => {
  const data = parse(characterSchema, req.body);
  res.json(await createCharacter((req as AuthedReq).userId, data as any));
}));

// ---- Items / Inventory ----
router.get("/items", (_req, res) => res.json(ITEM_CATALOG));

router.get("/inventory", handle(async (req, res) => {
  res.json(await getInventory(await charId(req)));
}));

router.post("/inventory/use", actionLimit, handle(async (req, res) => {
  const { itemKey } = parse(body.itemKey, req.body);
  res.json(await useItem(await charId(req), itemKey));
}));

router.post("/inventory/equip", actionLimit, handle(async (req, res) => {
  const { itemKey } = parse(body.itemKey, req.body);
  const equipped = await equipItem(await charId(req), itemKey);
  res.json({ equipped, message: "Equipped" });
}));

// ---- Shops ----
router.get("/shops", handle(async (_req, res) => {
  res.json(await prisma.shop.findMany());
}));

router.post("/shops/buy", actionLimit, handle(async (req, res) => {
  const { itemKey, quantity, shopKey } = parse(body.buyItem, req.body);
  const id = await charId(req);
  if (shopKey) {
    const shop = await prisma.shop.findUnique({ where: { key: shopKey } });
    if (!shop) throw new GameError("Shop not found");
    const items = shop.items as { itemKey: string; priceOverride?: number }[];
    const listing = items.find((i) => i.itemKey === itemKey);
    if (!listing) throw new GameError("Item not sold here");
    return res.json(await buyItem(id, itemKey, quantity, listing.priceOverride));
  }
  res.json(await buyItem(id, itemKey, quantity));
}));

// ---- Jobs ----
router.get("/jobs", handle(async (_req, res) => res.json(await listJobs())));

router.post("/jobs/apply", actionLimit, handle(async (req, res) => {
  const { jobId } = parse(body.jobApply, req.body);
  res.json(await applyForJob(await charId(req), jobId));
}));

router.post("/jobs/quit", actionLimit, handle(async (req, res) => {
  res.json(await quitJob(await charId(req)));
}));

router.post("/jobs/work", actionLimit, handle(async (req, res) => {
  res.json(await workShift(await charId(req)));
}));

// ---- Friends ----
router.get("/friends", handle(async (req, res) => {
  res.json(await listFriends(await charId(req)));
}));

router.get("/friends/requests", handle(async (req, res) => {
  res.json(await listPendingRequests(await charId(req)));
}));

router.post("/friends/request", actionLimit, handle(async (req, res) => {
  const { toCharacterId } = parse(body.friendRequest, req.body);
  res.json(await sendFriendRequest(await charId(req), toCharacterId));
}));

router.post("/friends/respond", actionLimit, handle(async (req, res) => {
  const { requestId, accept } = parse(body.friendRespond, req.body);
  res.json(await respondFriendRequest(await charId(req), requestId, accept));
}));

router.post("/friends/remove", actionLimit, handle(async (req, res) => {
  const { friendId } = parse(body.friendRemove, req.body);
  res.json(await removeFriend(await charId(req), friendId));
}));

router.get("/players/search", handle(async (req, res) => {
  const q = parse(query.q, req.query.q ?? "");
  res.json(await searchPlayers(q, await charId(req)));
}));

// ---- Messages ----
router.get("/messages/:withId", handle(async (req, res) => {
  const withId = parse(idSchema, req.params.withId);
  res.json(await getPrivateMessages(await charId(req), withId));
}));

// ---- Bank ----
router.get("/bank", handle(async (req, res) => {
  res.json(await getBank(await charId(req)));
}));

router.post("/bank/deposit", actionLimit, handle(async (req, res) => {
  const { amount } = parse(body.amount, req.body);
  res.json(await deposit(await charId(req), amount));
}));

router.post("/bank/withdraw", actionLimit, handle(async (req, res) => {
  const { amount } = parse(body.amount, req.body);
  res.json(await withdraw(await charId(req), amount));
}));

router.post("/bank/transfer", actionLimit, handle(async (req, res) => {
  const { toCharacterId, amount } = parse(body.transfer, req.body);
  res.json(await transfer(await charId(req), toCharacterId, amount));
}));

router.get("/bank/transactions", handle(async (req, res) => {
  res.json(await recentTransactions(await charId(req)));
}));

// ---- Buildings / Housing ----
router.post("/location/enter", actionLimit, handle(async (req, res) => {
  const { locationKey } = parse(body.locationEnter, req.body);
  res.json(await enterBuilding(await charId(req), locationKey));
}));

router.post("/location/exit", actionLimit, handle(async (req, res) => {
  res.json(await exitToCity(await charId(req)));
}));

router.get("/properties", handle(async (_req, res) => {
  res.json(await listProperties());
}));

router.post("/properties/rent", actionLimit, handle(async (req, res) => {
  const { propertyId } = parse(body.propertyId, req.body);
  res.json(await rentProperty(await charId(req), propertyId));
}));

router.post("/properties/buy", actionLimit, handle(async (req, res) => {
  const { propertyId } = parse(body.propertyId, req.body);
  res.json(await buyProperty(await charId(req), propertyId));
}));

router.post("/properties/leave", actionLimit, handle(async (req, res) => {
  res.json(await leaveHome(await charId(req)));
}));

// ---- World / Countries / Player buildings ----

router.get("/world/cities/:key", handle(async (req, res) => {
  const city = await getCity(parse(keySchema, req.params.key));
  if (!city) return res.status(404).json({ error: "City not found" });
  res.json(city);
}));

router.get("/world/cities/:key/plots", handle(async (req, res) => {
  res.json(await listPlots(parse(keySchema, req.params.key)));
}));

router.get("/world/cities/:key/homes", handle(async (req, res) => {
  res.json(await listCityHomes(parse(keySchema, req.params.key)));
}));

router.get("/world/cities/:key/buildings", handle(async (req, res) => {
  res.json(await listCityBuildings(parse(keySchema, req.params.key)));
}));

router.get("/world/building-types", (_req, res) => {
  res.json(BUILDING_TYPES);
});

router.get("/world/my-buildings", handle(async (req, res) => {
  res.json(await myBuildings(await charId(req)));
}));

router.post("/world/plots/buy", actionLimit, handle(async (req, res) => {
  const { plotId } = parse(body.plotId, req.body);
  res.json(await buyPlot(await charId(req), plotId));
}));

router.post("/world/build", actionLimit, handle(async (req, res) => {
  // Starts a construction project — workers must be hired
  const { plotId, buildingType, name } = parse(body.build, req.body);
  res.json(await startConstruction(await charId(req), plotId, buildingType, name));
}));

router.get("/construction/projects", handle(async (req, res) => {
  res.json(await listOpenProjects(parse(query.optionalKey, req.query.cityKey)));
}));

router.get("/construction/projects/:id", handle(async (req, res) => {
  const p = await getProject(parse(idSchema, req.params.id));
  if (!p) return res.status(404).json({ error: "Not found" });
  res.json(p);
}));

router.get("/construction/roles", (_req, res) => {
  res.json(CONSTRUCTION_ROLES);
});

router.get("/construction/my-work", handle(async (req, res) => {
  res.json(await myConstructionWork(await charId(req)));
}));

router.get("/construction/workers/:roleKey", handle(async (req, res) => {
  res.json(await listWorkersByTrade(parse(keySchema, req.params.roleKey)));
}));

router.post("/construction/accept", actionLimit, handle(async (req, res) => {
  const { roleId } = parse(body.roleId, req.body);
  res.json(await acceptRole(await charId(req), roleId));
}));

router.post("/construction/work", actionLimit, handle(async (req, res) => {
  const { roleId } = parse(body.roleId, req.body);
  res.json(await workConstruction(await charId(req), roleId));
}));

router.post("/construction/cancel", actionLimit, handle(async (req, res) => {
  const { projectId } = parse(body.projectId, req.body);
  res.json(await cancelConstruction(await charId(req), projectId));
}));

// ---- Travel ----
router.post("/world/travel", actionLimit, handle(async (req, res) => {
  const { routeId, cityKey } = parse(body.travel, req.body);
  const id = await charId(req);
  if (routeId) return res.json(await takeRoute(id, routeId));
  res.json(await travelToCity(id, cityKey as string));
}));

router.get("/travel/options", handle(async (req, res) => {
  res.json(await getTravelOptions(await charId(req)));
}));

router.get("/travel/airports", handle(async (req, res) => {
  res.json(await listAirports(parse(query.optionalKey, req.query.country)));
}));

router.get("/travel/stations", handle(async (req, res) => {
  res.json(await listStations(parse(query.optionalKey, req.query.country)));
}));

// ---- Notifications ----
router.get("/notifications", handle(async (req, res) => {
  res.json(await listNotifications(await charId(req)));
}));

router.get("/notifications/unread", handle(async (req, res) => {
  res.json({ count: await unreadCount(await charId(req)) });
}));

router.post("/notifications/read", handle(async (req, res) => {
  const { id } = parse(body.notifRead, req.body ?? {});
  res.json(await markRead(await charId(req), id));
}));

// ---- Marketplace ----
router.get("/market", handle(async (req, res) => {
  res.json(await listMarket(parse(query.optionalKey, req.query.cityKey)));
}));

router.post("/market/list", actionLimit, handle(async (req, res) => {
  const { itemKey, quantity, priceEach } = parse(body.marketList, req.body);
  res.json(await createListing(await charId(req), itemKey, quantity, priceEach));
}));

router.post("/market/buy", actionLimit, handle(async (req, res) => {
  const { listingId, quantity } = parse(body.marketBuy, req.body);
  res.json(await buyListing(await charId(req), listingId, quantity));
}));

router.post("/market/cancel", actionLimit, handle(async (req, res) => {
  const { listingId } = parse(body.marketCancel, req.body);
  res.json(await cancelListing(await charId(req), listingId));
}));

// ---- Interactive homes: persistent furniture and usable appliances ----
router.get("/home/catalog", (_req, res) => res.json(FURNITURE_CATALOG));

router.get("/home/:propertyId/furniture", handle(async (req, res) => {
  res.json(await getHomeFurniture(await charId(req), parse(idSchema, req.params.propertyId)));
}));
router.post("/home/:propertyId/furniture/place", actionLimit, handle(async (req, res) => {
  const b = parse(body.furniturePlace, req.body);
  res.json(await placeFurniture(await charId(req), parse(idSchema, req.params.propertyId), b.furnitureKey, b.x, b.z, b.rotation));
}));
router.post("/home/:propertyId/furniture/move", actionLimit, handle(async (req, res) => {
  const b = parse(body.furnitureMove, req.body);
  res.json(await moveFurniture(await charId(req), parse(idSchema, req.params.propertyId), b.furnitureId, b.x, b.z, b.rotation));
}));
router.post("/home/:propertyId/furniture/remove", actionLimit, handle(async (req, res) => {
  const b = parse(body.furnitureRemove, req.body);
  res.json(await removeFurniture(await charId(req), parse(idSchema, req.params.propertyId), b.furnitureId));
}));
router.post("/home/:propertyId/interact", actionLimit, handle(async (req, res) => {
  const b = parse(body.furnitureInteract, req.body);
  res.json(await interactWithFurniture(await charId(req), parse(idSchema, req.params.propertyId), b.furnitureId, b.action));
}));

// ---- Player businesses ----
router.get("/business/types", handle(async (_req, res) => res.json(await listBusinessTypes())));
router.get("/business", handle(async (req, res) => {
  res.json(await listBusinesses(parse(query.optionalKey, req.query.cityKey)));
}));
router.get("/business/mine", handle(async (req, res) => res.json(await myBusinesses(await charId(req)))));
router.get("/business/employment", handle(async (req, res) => res.json(await myEmployment(await charId(req)))));
router.post("/business/open", actionLimit, handle(async (req, res) => {
  res.json(await openBusiness(await charId(req), parse(body.businessOpen, req.body)));
}));
router.post("/business/post-job", actionLimit, handle(async (req, res) => {
  const b = parse(body.businessPostJob, req.body);
  res.json(await postJob(await charId(req), b.businessId, b));
}));
router.post("/business/apply", actionLimit, handle(async (req, res) => {
  res.json(await applyToBusiness(await charId(req), parse(body.businessApply, req.body).postId));
}));
router.post("/business/work", actionLimit, handle(async (req, res) => {
  res.json(await workBusinessShift(await charId(req), parse(body.businessId, req.body).businessId));
}));
router.post("/business/buy", actionLimit, handle(async (req, res) => {
  const b = parse(body.businessBuy, req.body);
  res.json(await buyFromBusiness(await charId(req), b.productId, b.quantity));
}));
router.post("/business/restock", actionLimit, handle(async (req, res) => {
  const b = parse(body.businessRestock, req.body);
  res.json(await restockProduct(await charId(req), b.businessId, b.productId, b.quantity));
}));
router.post("/business/open-close", actionLimit, handle(async (req, res) => {
  const b = parse(body.businessOpenClose, req.body);
  res.json(await setBusinessOpen(await charId(req), b.businessId, b.open));
}));
router.post("/business/withdraw", actionLimit, handle(async (req, res) => {
  const b = parse(body.businessWithdraw, req.body);
  res.json(await withdrawBusiness(await charId(req), b.businessId, b.amount));
}));
router.post("/business/quit", actionLimit, handle(async (req, res) => {
  res.json(await quitBusinessJob(await charId(req), parse(body.businessId, req.body).businessId));
}));

// ---- Vehicles ----
router.get("/vehicles/catalog", handle(async (_req, res) => res.json(await vehicleCatalog())));
router.get("/vehicles/mine", handle(async (req, res) => res.json(await myVehicles(await charId(req)))));
router.post("/vehicles/buy", actionLimit, handle(async (req, res) => {
  res.json(await buyVehicle(await charId(req), parse(body.vehicleBuy, req.body).type));
}));
router.post("/vehicles/drive", actionLimit, handle(async (req, res) => {
  res.json(await driveVehicle(await charId(req), parse(body.vehicleDrive, req.body).vehicleId));
}));

// ---- School ----
router.get("/school/courses", handle(async (_req, res) => res.json(await listCourses())));
router.get("/school/progress", handle(async (req, res) => res.json(await myProgress(await charId(req)))));
router.post("/school/attend", actionLimit, handle(async (req, res) => {
  res.json(await attendCourse(await charId(req), parse(body.courseAttend, req.body).courseKey));
}));

// ---- Competitions + leaderboards ----
// Rounds close automatically on a timer (see socketHandler); only admins can end one early.
router.get("/competitions", handle(async (_req, res) => res.json(await listCompetitions())));
router.post("/competitions/enter", actionLimit, handle(async (req, res) => {
  res.json(await enterCompetition(await charId(req), parse(body.competitionId, req.body).competitionId));
}));
router.post("/competitions/resolve", actionLimit, handle(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: (req as AuthedReq).userId }, select: { isAdmin: true } });
  if (!user?.isAdmin) throw new GameError("Only admins can end a round early", 403);
  res.json(await resolveCompetition(parse(body.competitionId, req.body).competitionId));
}));
router.get("/leaderboards", handle(async (_req, res) => res.json(await leaderboards())));

export default router;

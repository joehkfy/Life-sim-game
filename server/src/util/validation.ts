import { z } from "zod";
import { GameError } from "./errors";
import { MAX_TX_AMOUNT } from "./money";

export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const issue = r.error.issues[0];
    const where = issue && issue.path.length ? `${issue.path.join(".")}: ` : "";
    throw new GameError(`${where}${issue?.message || "Invalid request"}`);
  }
  return r.data;
}

export const idSchema = z.string().min(1).max(64);
export const keySchema = z.string().min(1).max(64);
const intAmount = z.coerce.number().finite().int().min(1).max(MAX_TX_AMOUNT);

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "Username must be 3-20 letters, numbers or underscores"),
  email: z.string().trim().toLowerCase().email("Invalid email").max(120),
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(120),
  password: z.string().min(1).max(200),
});

export const characterSchema = z.object({
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2,3}$/, "Pick a country"),
  stateCode: z.string().trim().toUpperCase().max(40).default(""),
  cityKey: keySchema,
  lifeStage: z.enum(["child", "adult"]).default("adult"),
  age: z.coerce.number().int().min(5).max(90).optional(),
  name: z
    .string()
    .trim()
    .regex(/^[\p{L}\p{N} '\-]{2,24}$/u, "Name must be 2-24 characters (letters, numbers, spaces, - and ')"),
  personality: z.string().trim().max(30).optional(),
  appearance: z.object({
    skinTone: z.number().min(0).max(1),
    hairStyle: z.number().int().min(0).max(50),
    hairColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hair colour"),
    facePreset: z.number().int().min(0).max(50),
    clothingTop: z.number().int().min(0).max(50),
    clothingBottom: z.number().int().min(0).max(50),
    accessories: z.array(z.number().int().min(0).max(50)).max(10).default([]),
  }),
});

const skillEnum = z.enum(["intelligence", "strength", "charisma", "creativity", "cooking", "fitness"]);

export const body = {
  npcChat: z.object({
    residentId: z.string().trim().regex(/^resident-[a-z0-9_-]{1,30}$/i, "Invalid resident"),
    residentName: z.string().trim().min(1).max(60),
    residentRole: z.string().trim().min(1).max(40),
    activity: z.string().trim().min(1).max(80),
    cityKey: keySchema,
    weather: z.string().trim().max(30).default("sunny"),
    worldTime: z.coerce.number().finite().min(0).max(24),
    message: z.string().trim().min(1, "Write a message first").max(500),
    history: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().trim().min(1).max(500),
    })).max(8).default([]),
  }),
  furniturePlace: z.object({
    furnitureKey: keySchema,
    x: z.number().finite().optional(),
    z: z.number().finite().optional(),
    rotation: z.number().finite().optional(),
  }),
  furnitureMove: z.object({
    furnitureId: idSchema,
    x: z.number().finite(),
    z: z.number().finite(),
    rotation: z.number().finite().optional(),
  }),
  furnitureRemove: z.object({ furnitureId: idSchema }),
  furnitureInteract: z.object({ furnitureId: idSchema, action: keySchema }),
  businessOpen: z.object({
    name: z.string().trim().min(2, "Name your business").max(40),
    type: keySchema,
    buildingId: idSchema.optional(),
  }),
  businessPostJob: z.object({
    businessId: idSchema,
    title: z.string().trim().max(30).optional(),
    roleKey: z.string().trim().max(30).default("worker"),
    salary: z.coerce.number().finite().int().min(10).max(500),
    minSkill: skillEnum.optional(),
    minSkillVal: z.coerce.number().finite().min(0).max(100).optional(),
  }),
  businessApply: z.object({ postId: idSchema }),
  businessId: z.object({ businessId: idSchema }),
  businessBuy: z.object({
    productId: idSchema,
    quantity: z.coerce.number().finite().int().min(1).max(20).default(1),
  }),
  businessOpenClose: z.object({ businessId: idSchema, open: z.boolean() }),
  businessWithdraw: z.object({ businessId: idSchema, amount: intAmount }),
  businessRestock: z.object({
    businessId: idSchema,
    productId: idSchema,
    quantity: z.coerce.number().finite().int().min(1).max(100).default(10),
  }),
  vehicleBuy: z.object({ type: keySchema }),
  vehicleDrive: z.object({ vehicleId: idSchema }),
  courseAttend: z.object({ courseKey: keySchema }),
  competitionId: z.object({ competitionId: idSchema }),
  itemKey: z.object({ itemKey: keySchema }),
  buyItem: z.object({
    itemKey: keySchema,
    quantity: z.coerce.number().finite().int().min(1).max(99).default(1),
    shopKey: keySchema.optional(),
  }),
  jobApply: z.object({ jobId: idSchema }),
  friendRequest: z.object({ toCharacterId: idSchema }),
  friendRespond: z.object({ requestId: idSchema, accept: z.boolean() }),
  friendRemove: z.object({ friendId: idSchema }),
  amount: z.object({ amount: intAmount }),
  transfer: z.object({ toCharacterId: idSchema, amount: intAmount }),
  locationEnter: z.object({ locationKey: z.string().min(1).max(80) }),
  propertyId: z.object({ propertyId: idSchema }),
  plotId: z.object({ plotId: idSchema }),
  build: z.object({
    plotId: idSchema,
    buildingType: keySchema,
    name: z.string().trim().min(2, "Name your building").max(40),
  }),
  roleId: z.object({ roleId: idSchema }),
  projectId: z.object({ projectId: idSchema }),
  travel: z
    .object({ routeId: idSchema.optional(), cityKey: keySchema.optional() })
    .refine((v) => v.routeId || v.cityKey, "routeId or cityKey is required"),
  notifRead: z.object({ id: idSchema.optional() }),
  marketList: z.object({
    itemKey: keySchema,
    quantity: z.coerce.number().finite().int().min(1).max(99).default(1),
    priceEach: z.coerce.number().finite().int().min(1).max(MAX_TX_AMOUNT),
  }),
  marketBuy: z.object({
    listingId: idSchema,
    quantity: z.coerce.number().finite().int().min(1).max(99).optional(),
  }),
  marketCancel: z.object({ listingId: idSchema }),
};

export const query = {
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2,3}$/).optional(),
  stateCode: z.string().trim().toUpperCase().max(40).optional(),
  q: z.string().max(40).default(""),
  optionalKey: keySchema.optional(),
};

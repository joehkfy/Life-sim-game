import { prisma } from "../../db/client";
import { GameError } from "../../util/errors";
import { isUniqueViolation } from "../../util/db";

const sorted = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export async function areFriends(a: string, b: string): Promise<boolean> {
  const f = await prisma.friendship.findFirst({
    where: { OR: [{ aId: a, bId: b }, { aId: b, bId: a }] },
    select: { id: true },
  });
  return !!f;
}

export async function sendFriendRequest(fromId: string, toCharacterId: string) {
  if (fromId === toCharacterId) throw new GameError("Cannot friend yourself");

  const target = await prisma.character.findUnique({ where: { id: toCharacterId } });
  if (!target) throw new GameError("Player not found");

  if (await areFriends(fromId, toCharacterId)) throw new GameError("Already friends");

  const reverse = await prisma.friendRequest.findFirst({ where: { fromId: toCharacterId, toId: fromId, status: "pending" } });
  if (reverse) throw new GameError("They already sent you a request — check your pending requests");

  const existing = await prisma.friendRequest.findUnique({ where: { fromId_toId: { fromId, toId: toCharacterId } } });
  if (existing?.status === "pending") throw new GameError("Friend request already pending");

  // FriendRequest is unique per (from,to): re-use the old row after a rejection / unfriend instead of crashing.
  const req = existing
    ? await prisma.friendRequest.update({ where: { id: existing.id }, data: { status: "pending", createdAt: new Date() } })
    : await prisma.friendRequest.create({ data: { fromId, toId: toCharacterId, status: "pending" } }).catch((e) => {
        if (isUniqueViolation(e)) throw new GameError("Friend request already pending");
        throw e;
      });

  return { message: `Friend request sent to ${target.name}`, request: req };
}

export async function respondFriendRequest(characterId: string, requestId: string, accept: boolean) {
  return prisma.$transaction(async (tx) => {
    const status = accept ? "accepted" : "rejected";
    // Atomic: a request can only be answered once, even with double-clicks.
    const claimed = await tx.friendRequest.updateMany({
      where: { id: requestId, toId: characterId, status: "pending" },
      data: { status },
    });
    if (claimed.count !== 1) throw new GameError("Request not found or already handled");

    if (accept) {
      const req = await tx.friendRequest.findUnique({ where: { id: requestId } });
      if (req) {
        const [aId, bId] = sorted(req.fromId, req.toId);
        const dup = await tx.friendship.findFirst({
          where: { OR: [{ aId, bId }, { aId: bId, bId: aId }] },
        });
        if (!dup) await tx.friendship.create({ data: { aId, bId } });
      }
      return { message: "Friend request accepted" };
    }
    return { message: "Friend request rejected" };
  });
}

export async function listFriends(characterId: string) {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ aId: characterId }, { bId: characterId }] },
    include: {
      a: { select: { id: true, name: true, appearance: true, lastLogin: true } },
      b: { select: { id: true, name: true, appearance: true, lastLogin: true } },
    },
  });

  return friendships.map((f) => {
    const friend = f.aId === characterId ? f.b : f.a;
    return { friendshipId: f.id, id: friend.id, name: friend.name, appearance: friend.appearance, lastLogin: friend.lastLogin };
  });
}

export async function listPendingRequests(characterId: string) {
  const incoming = await prisma.friendRequest.findMany({
    where: { toId: characterId, status: "pending" },
    include: { from: { select: { id: true, name: true, appearance: true } } },
  });
  return incoming.map((r) => ({
    id: r.id,
    fromId: r.from.id,
    fromName: r.from.name,
    fromAppearance: r.from.appearance,
    createdAt: r.createdAt,
  }));
}

export async function removeFriend(characterId: string, friendId: string) {
  const f = await prisma.friendship.findFirst({
    where: { OR: [{ aId: characterId, bId: friendId }, { aId: friendId, bId: characterId }] },
  });
  if (!f) throw new GameError("Not friends");
  await prisma.friendship.delete({ where: { id: f.id } });
  return { message: "Friend removed" };
}

export async function searchPlayers(query: string, excludeId: string) {
  const q = query.trim();
  if (q.length < 2) return [];
  return prisma.character.findMany({
    where: { name: { contains: q, mode: "insensitive" }, id: { not: excludeId } },
    select: { id: true, name: true, appearance: true },
    take: 20,
  });
}

export async function getPrivateMessages(characterId: string, withId: string, limit = 50) {
  // Newest N, returned oldest-first (it used to return the OLDEST 50 forever).
  const msgs = await prisma.message.findMany({
    where: {
      channel: "private",
      OR: [
        { fromId: characterId, toId: withId },
        { fromId: withId, toId: characterId },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { from: { select: { name: true } } },
  });
  return msgs.reverse().map((m) => ({
    id: m.id,
    fromId: m.fromId,
    fromName: m.from.name,
    toId: m.toId,
    content: m.content,
    createdAt: m.createdAt,
    read: m.read,
  }));
}

export async function savePrivateMessage(fromId: string, toId: string, content: string) {
  return prisma.message.create({
    data: { fromId, toId, channel: "private", content: content.slice(0, 500) },
  });
}

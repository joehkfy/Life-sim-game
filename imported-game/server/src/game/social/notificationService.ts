import { prisma } from "../../db/client";

export async function pushNotification(
  characterId: string,
  title: string,
  body: string,
  type: string = "info",
  data: Record<string, unknown> = {}
) {
  return prisma.notification.create({
    data: { characterId, title, body, type, data: data as any },
  });
}

export async function listNotifications(characterId: string, limit = 40) {
  return prisma.notification.findMany({
    where: { characterId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markRead(characterId: string, id?: string) {
  if (id) {
    await prisma.notification.updateMany({
      where: { id, characterId },
      data: { read: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: { characterId, read: false },
      data: { read: true },
    });
  }
  return { ok: true };
}

export async function unreadCount(characterId: string) {
  return prisma.notification.count({ where: { characterId, read: false } });
}

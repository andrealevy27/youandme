import { and, desc, eq, or } from "drizzle-orm";
import { db } from "../db";
import { connections, profiles } from "../db/schema";
import { AppError, forbidden, notFound } from "../errors";
import { notify } from "../notifications";
import { canViewProfile } from "../privacy/visibility";
import { enforceRateLimit } from "../rate-limit";
import { track } from "../analytics";
import { getPersonSummaries } from "../people";

export type ConnectionState = "none" | "outgoing" | "incoming" | "connected";

export async function getConnectionState(viewerId: string, otherId: string): Promise<{ state: ConnectionState; id: string | null }> {
  const [row] = await db
    .select()
    .from(connections)
    .where(
      or(
        and(eq(connections.requesterId, viewerId), eq(connections.addresseeId, otherId)),
        and(eq(connections.requesterId, otherId), eq(connections.addresseeId, viewerId)),
      ),
    )
    .orderBy(desc(connections.createdAt))
    .limit(1);
  if (!row || row.status === "declined" || row.status === "withdrawn") return { state: "none", id: row?.id ?? null };
  if (row.status === "accepted") return { state: "connected", id: row.id };
  return { state: row.requesterId === viewerId ? "outgoing" : "incoming", id: row.id };
}

export async function requestConnection(viewerId: string, otherId: string, message?: string) {
  if (viewerId === otherId) throw new AppError("VALIDATION", "You can't connect with yourself.");
  enforceRateLimit("connection", viewerId);
  if (!(await canViewProfile(viewerId, otherId))) throw forbidden("This profile isn't available.");
  const current = await getConnectionState(viewerId, otherId);
  if (current.state === "connected" || current.state === "outgoing") return current;
  if (current.state === "incoming") return respondToConnection(viewerId, current.id!, true);
  // Reuse the pair row if one exists (unique on requester/addressee).
  await db
    .insert(connections)
    .values({ requesterId: viewerId, addresseeId: otherId, message: message?.slice(0, 300) ?? null })
    .onConflictDoUpdate({
      target: [connections.requesterId, connections.addresseeId],
      set: { status: "pending", message: message?.slice(0, 300) ?? null, createdAt: new Date(), respondedAt: null },
    });
  const [me] = await db.select({ name: profiles.displayName, handle: profiles.handle }).from(profiles).where(eq(profiles.userId, viewerId));
  await notify({
    userId: otherId,
    type: "connection_request",
    title: `${me?.name ?? "Someone"} wants to connect`,
    body: message?.slice(0, 140),
    href: `/people/${me?.handle ?? ""}`,
    actorId: viewerId,
  });
  track("connection_requested", viewerId);
  return getConnectionState(viewerId, otherId);
}

export async function respondToConnection(viewerId: string, connectionId: string, accept: boolean) {
  const [row] = await db.select().from(connections).where(eq(connections.id, connectionId)).limit(1);
  if (!row) throw notFound("Connection request");
  if (row.addresseeId !== viewerId || row.status !== "pending") throw forbidden();
  await db
    .update(connections)
    .set({ status: accept ? "accepted" : "declined", respondedAt: new Date() })
    .where(eq(connections.id, connectionId));
  if (accept) {
    const [me] = await db.select({ name: profiles.displayName, handle: profiles.handle }).from(profiles).where(eq(profiles.userId, viewerId));
    await notify({
      userId: row.requesterId,
      type: "connection_request",
      title: `${me?.name ?? "Someone"} accepted your connection`,
      href: `/people/${me?.handle ?? ""}`,
      actorId: viewerId,
    });
  }
  return getConnectionState(viewerId, row.requesterId);
}

export async function removeConnection(viewerId: string, otherId: string) {
  const current = await getConnectionState(viewerId, otherId);
  if (!current.id) return;
  const status = current.state === "outgoing" ? "withdrawn" : "declined";
  await db.update(connections).set({ status, respondedAt: new Date() }).where(eq(connections.id, current.id));
}

export async function listIncomingRequests(viewerId: string) {
  const rows = await db
    .select()
    .from(connections)
    .where(and(eq(connections.addresseeId, viewerId), eq(connections.status, "pending")))
    .orderBy(desc(connections.createdAt))
    .limit(50);
  const people = await getPersonSummaries(rows.map((r) => r.requesterId));
  return rows.map((r) => ({ id: r.id, message: r.message, createdAt: r.createdAt, person: people.find((p) => p.userId === r.requesterId) })).filter((r) => r.person);
}

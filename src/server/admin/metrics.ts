import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/domain";

/**
 * Overview analytics. Every number comes from real rows — nothing is estimated or padded.
 * Demo records (profiles.is_demo / startups.is_demo) are excluded unless `includeDemo`.
 */

export type MoneyByCurrency = { currency: string; cents: number }[];

export type OverviewMetrics = {
  includeDemo: boolean;
  users: { total: number; active7d: number; active30d: number; onboarded: number };
  founders: number;
  consultants: { approved: number; pending: number };
  startups: number;
  matches: number;
  conversations: number;
  bookingsByStatus: Record<BookingStatus, number>;
  gmv: MoneyByCurrency;
  revenue: { gross: MoneyByCurrency; refunded: MoneyByCurrency; net: MoneyByCurrency };
  signups30d: { started: number; completed: number };
  recommendations14d: { generated: number; viewed: number; actedOn: number };
  signupsByDay: { day: string; count: number }[];
};

type Row = Record<string, unknown>;

async function rows<T extends Row>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return result as unknown as T[];
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;

/** SQL predicate: the given user id column belongs to a non-demo profile (or demo is included). */
function realUser(userIdCol: SQL, includeDemo: boolean): SQL {
  if (includeDemo) return sql`true`;
  return sql`not exists (select 1 from profiles dp where dp.user_id = ${userIdCol} and dp.is_demo)`;
}

function moneyRows(list: { currency: string; cents: unknown }[]): MoneyByCurrency {
  return list.map((r) => ({ currency: r.currency, cents: num(r.cents) })).filter((r) => r.cents !== 0);
}

function subtractMoney(a: MoneyByCurrency, b: MoneyByCurrency): MoneyByCurrency {
  const map = new Map<string, number>();
  for (const r of a) map.set(r.currency, (map.get(r.currency) ?? 0) + r.cents);
  for (const r of b) map.set(r.currency, (map.get(r.currency) ?? 0) - r.cents);
  return [...map.entries()].map(([currency, cents]) => ({ currency, cents })).filter((r) => r.cents !== 0);
}

export async function getOverviewMetrics({ includeDemo }: { includeDemo: boolean }): Promise<OverviewMetrics> {
  const demoProfile = includeDemo ? sql`true` : sql`not p.is_demo`;

  const [counts] = await rows<Row>(sql`
    select
      (select count(*) from profiles p where p.deleted_at is null and p.status <> 'deleted' and ${demoProfile}) as total_users,
      (select count(*) from profiles p where p.deleted_at is null and p.status = 'active' and p.last_active_at > now() - interval '7 days' and ${demoProfile}) as active_7d,
      (select count(*) from profiles p where p.deleted_at is null and p.status = 'active' and p.last_active_at > now() - interval '30 days' and ${demoProfile}) as active_30d,
      (select count(*) from profiles p where p.deleted_at is null and p.status <> 'deleted' and p.onboarding_completed_at is not null and ${demoProfile}) as onboarded,
      (select count(*) from user_roles r join profiles p on p.user_id = r.user_id where r.role = 'founder' and p.deleted_at is null and ${demoProfile}) as founders,
      (select count(*) from consultant_profiles c join profiles p on p.user_id = c.user_id where c.status = 'approved' and p.deleted_at is null and ${demoProfile}) as consultants_approved,
      (select count(*) from consultant_profiles c join profiles p on p.user_id = c.user_id where c.status = 'pending_review' and p.deleted_at is null and ${demoProfile}) as consultants_pending,
      (select count(*) from startups s where s.deleted_at is null and ${includeDemo ? sql`true` : sql`not s.is_demo`}) as startups,
      (select count(*) from matches m where m.unmatched_at is null and ${realUser(sql`m.user_a_id`, includeDemo)} and ${realUser(sql`m.user_b_id`, includeDemo)}) as matches,
      (select count(*) from conversations c where ${includeDemo ? sql`true` : sql`not exists (select 1 from conversation_members cm join profiles dp on dp.user_id = cm.user_id where cm.conversation_id = c.id and dp.is_demo)`}) as conversations,
      (select count(*) from analytics_events e where e.name = 'signup_started' and e.created_at > now() - interval '30 days' and (e.user_id is null or ${realUser(sql`e.user_id`, includeDemo)})) as signup_started,
      (select count(*) from analytics_events e where e.name = 'signup_completed' and e.created_at > now() - interval '30 days' and (e.user_id is null or ${realUser(sql`e.user_id`, includeDemo)})) as signup_completed,
      (select count(*) from recommendations rc where rc.for_date >= current_date - 13 and ${realUser(sql`rc.user_id`, includeDemo)}) as recs_generated,
      (select count(*) from recommendations rc where rc.for_date >= current_date - 13 and rc.viewed_at is not null and ${realUser(sql`rc.user_id`, includeDemo)}) as recs_viewed,
      (select count(*) from recommendations rc where rc.for_date >= current_date - 13 and rc.action <> 'none' and ${realUser(sql`rc.user_id`, includeDemo)}) as recs_acted
  `);
  const c = counts ?? {};

  const bookingFilter = realUser(sql`b.client_id`, includeDemo);
  const statusRows = await rows<{ status: string; n: unknown }>(
    sql`select b.status, count(*) as n from bookings b where ${bookingFilter} group by b.status`,
  );
  const bookingsByStatus = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, 0])) as Record<BookingStatus, number>;
  for (const r of statusRows) if (r.status in bookingsByStatus) bookingsByStatus[r.status as BookingStatus] = num(r.n);

  const [gmvRows, grossRows, refundedRows] = await Promise.all([
    rows<{ currency: string; cents: unknown }>(
      sql`select b.currency, sum(b.amount_cents) as cents from bookings b where b.status in ('confirmed','completed') and ${bookingFilter} group by b.currency order by cents desc`,
    ),
    // Fees earned on every booking that was ever paid (confirmed, completed, or later refunded)…
    rows<{ currency: string; cents: unknown }>(
      sql`select b.currency, sum(b.platform_fee_cents) as cents from bookings b where b.status in ('confirmed','completed','refunded') and ${bookingFilter} group by b.currency order by cents desc`,
    ),
    // …minus fees returned on refunded bookings.
    rows<{ currency: string; cents: unknown }>(
      sql`select b.currency, sum(b.platform_fee_cents) as cents from bookings b where b.status = 'refunded' and ${bookingFilter} group by b.currency order by cents desc`,
    ),
  ]);
  const gross = moneyRows(grossRows);
  const refunded = moneyRows(refundedRows);

  const signupRows = await rows<{ day: string; n: unknown }>(sql`
    select to_char(d.day, 'YYYY-MM-DD') as day, count(p.user_id) as n
    from generate_series(current_date - 29, current_date, interval '1 day') as d(day)
    left join profiles p on p.created_at >= d.day and p.created_at < d.day + interval '1 day' and ${demoProfile}
    group by d.day order by d.day
  `);

  return {
    includeDemo,
    users: { total: num(c.total_users), active7d: num(c.active_7d), active30d: num(c.active_30d), onboarded: num(c.onboarded) },
    founders: num(c.founders),
    consultants: { approved: num(c.consultants_approved), pending: num(c.consultants_pending) },
    startups: num(c.startups),
    matches: num(c.matches),
    conversations: num(c.conversations),
    bookingsByStatus,
    gmv: moneyRows(gmvRows),
    revenue: { gross, refunded, net: subtractMoney(gross, refunded) },
    signups30d: { started: num(c.signup_started), completed: num(c.signup_completed) },
    recommendations14d: { generated: num(c.recs_generated), viewed: num(c.recs_viewed), actedOn: num(c.recs_acted) },
    signupsByDay: signupRows.map((r) => ({ day: r.day, count: num(r.n) })),
  };
}

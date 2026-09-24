import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { user } from "./auth";
import {
  commitmentEnum,
  fundingStatusEnum,
  inviteStatusEnum,
  needStatusEnum,
  needTypeEnum,
  startupMemberRoleEnum,
  startupStageEnum,
  visibilityEnum,
  workModeEnum,
} from "./enums";
import { industries, skills } from "./people";

export const startups = pgTable(
  "startups",
  {
    id: text("id").primaryKey().$defaultFn(id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    tagline: text("tagline"),
    description: text("description"),
    problem: text("problem"),
    solution: text("solution"),
    stage: startupStageEnum("stage").notNull().default("idea"),
    businessModel: text("business_model"),
    foundedOn: date("founded_on"),
    location: text("location"),
    workMode: workModeEnum("work_mode"),
    websiteUrl: text("website_url"),
    pitchDeckUrl: text("pitch_deck_url"),
    traction: text("traction"),
    fundingStatus: fundingStatusEnum("funding_status"),
    fundingRaisedCents: bigint("funding_raised_cents", { mode: "number" }),
    teamSize: integer("team_size"),
    /** active | paused | acquired | shut_down */
    status: text("status").notNull().default("active"),
    visibility: visibilityEnum("visibility").notNull().default("public"),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    isDemo: boolean("is_demo").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("startups_slug_idx").on(sql`lower(${t.slug})`),
    index("startups_stage_idx").on(t.stage),
    index("startups_search_idx").using(
      "gin",
      sql`to_tsvector('english', coalesce(${t.name},'') || ' ' || coalesce(${t.tagline},'') || ' ' || coalesce(${t.description},'') || ' ' || coalesce(${t.problem},'') || ' ' || coalesce(${t.solution},''))`,
    ),
  ],
);

export const startupIndustries = pgTable(
  "startup_industries",
  {
    startupId: text("startup_id")
      .notNull()
      .references(() => startups.id, { onDelete: "cascade" }),
    industryId: text("industry_id")
      .notNull()
      .references(() => industries.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.startupId, t.industryId] })],
);

/** Team membership. `isAdmin` grants management permissions (see server/authz). */
export const startupMembers = pgTable(
  "startup_members",
  {
    id: text("id").primaryKey().$defaultFn(id),
    startupId: text("startup_id")
      .notNull()
      .references(() => startups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: startupMemberRoleEnum("role").notNull(),
    title: text("title"),
    isAdmin: boolean("is_admin").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("startup_members_unique_idx").on(t.startupId, t.userId),
    index("startup_members_user_idx").on(t.userId),
  ],
);

export const startupInvites = pgTable(
  "startup_invites",
  {
    id: text("id").primaryKey().$defaultFn(id),
    startupId: text("startup_id")
      .notNull()
      .references(() => startups.id, { onDelete: "cascade" }),
    email: text("email"),
    invitedUserId: text("invited_user_id").references(() => user.id, { onDelete: "cascade" }),
    role: startupMemberRoleEnum("role").notNull(),
    makeAdmin: boolean("make_admin").notNull().default(false),
    token: text("token").notNull().unique(),
    invitedById: text("invited_by_id").references(() => user.id, { onDelete: "set null" }),
    status: inviteStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("startup_invites_startup_idx").on(t.startupId), index("startup_invites_user_idx").on(t.invitedUserId)],
);

export const openRoles = pgTable(
  "open_roles",
  {
    id: text("id").primaryKey().$defaultFn(id),
    startupId: text("startup_id")
      .notNull()
      .references(() => startups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** cofounder | employee | contractor | advisor */
    type: text("type").notNull(),
    description: text("description"),
    commitment: commitmentEnum("commitment"),
    location: text("location"),
    compensation: text("compensation"),
    equity: text("equity"),
    isOpen: boolean("is_open").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("open_roles_startup_idx").on(t.startupId)],
);

/** "What I/we need right now" — the needs layer that drives personalization. */
export const needs = pgTable(
  "needs",
  {
    id: text("id").primaryKey().$defaultFn(id),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startupId: text("startup_id").references(() => startups.id, { onDelete: "cascade" }),
    type: needTypeEnum("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    consultantCategoryId: text("consultant_category_id"),
    commitment: commitmentEnum("commitment"),
    budgetMaxCents: integer("budget_max_cents"),
    status: needStatusEnum("status").notNull().default("open"),
    ...timestamps,
  },
  (t) => [index("needs_owner_idx").on(t.ownerId, t.status), index("needs_startup_idx").on(t.startupId, t.status)],
);

export const needSkills = pgTable(
  "need_skills",
  {
    needId: text("need_id")
      .notNull()
      .references(() => needs.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.needId, t.skillId] })],
);

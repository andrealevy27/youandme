import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps, id } from "./_shared";
import { user } from "./auth";
import {
  accountStatusEnum,
  ambitionEnum,
  availabilityEnum,
  commitmentEnum,
  founderExperienceEnum,
  visibilityEnum,
  workModeEnum,
} from "./enums";

/** App profile, 1:1 with `user`. Soft-deleted/anonymised on account deletion. */
export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull(),
    headline: text("headline"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    location: text("location"),
    city: text("city"),
    country: text("country"),
    timezone: text("timezone").notNull().default("UTC"),
    university: text("university"),
    currentRole: text("current_role"),
    currentCompany: text("current_company"),
    linkedinUrl: text("linkedin_url"),
    websiteUrl: text("website_url"),
    githubUrl: text("github_url"),
    portfolioUrl: text("portfolio_url"),
    intents: text("intents").array().notNull().default(sql`'{}'::text[]`),
    availability: availabilityEnum("availability"),
    commitment: commitmentEnum("commitment"),
    workMode: workModeEnum("work_mode"),
    ambition: ambitionEnum("ambition"),
    founderExperience: founderExperienceEnum("founder_experience"),
    yearsExperience: smallint("years_experience"),
    lookingForCofounder: boolean("looking_for_cofounder").notNull().default(false),
    cofounderTypes: text("cofounder_types").array().notNull().default(sql`'{}'::text[]`),
    stagePreferences: text("stage_preferences").array().notNull().default(sql`'{}'::text[]`),
    equityExpectation: text("equity_expectation"),
    lookingFor: text("looking_for"),
    goals: text("goals"),
    visibility: visibilityEnum("visibility").notNull().default("public"),
    status: accountStatusEnum("status").notNull().default("active"),
    isDemo: boolean("is_demo").notNull().default(false),
    featured: boolean("featured").notNull().default(false),
    onboardingStep: integer("onboarding_step").notNull().default(0),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
    suspendedUntil: timestamp("suspended_until", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("profiles_handle_idx").on(sql`lower(${t.handle})`),
    index("profiles_discovery_idx").on(t.status, t.visibility, t.lastActiveAt),
    index("profiles_cofounder_idx").on(t.lookingForCofounder, t.status),
    // Keyword search. Future: add a pgvector embedding column fed by the same fields.
    index("profiles_search_idx").using(
      "gin",
      sql`to_tsvector('english', coalesce(${t.displayName},'') || ' ' || coalesce(${t.headline},'') || ' ' || coalesce(${t.bio},'') || ' ' || coalesce(${t.university},'') || ' ' || coalesce(${t.currentRole},'') || ' ' || coalesce(${t.currentCompany},'') || ' ' || coalesce(${t.lookingFor},''))`,
    ),
  ],
);

/** Platform roles (founder, consultant, …). Text so new roles need no migration. */
export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] }), index("user_roles_role_idx").on(t.role)],
);

export const experiences = pgTable(
  "experiences",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    company: text("company").notNull(),
    description: text("description"),
    startYear: smallint("start_year"),
    endYear: smallint("end_year"),
    isCurrent: boolean("is_current").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("experiences_user_idx").on(t.userId)],
);

export const educations = pgTable(
  "educations",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    school: text("school").notNull(),
    degree: text("degree"),
    field: text("field"),
    startYear: smallint("start_year"),
    endYear: smallint("end_year"),
    ...timestamps,
  },
  (t) => [index("educations_user_idx").on(t.userId)],
);

export const skills = pgTable(
  "skills",
  {
    id: text("id").primaryKey().$defaultFn(id),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("skills_category_idx").on(t.category)],
);

export const userSkills = pgTable(
  "user_skills",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    /** 1 = working knowledge, 2 = strong, 3 = expert */
    level: smallint("level").notNull().default(2),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.skillId] }), index("user_skills_skill_idx").on(t.skillId)],
);

export const industries = pgTable("industries", {
  id: text("id").primaryKey().$defaultFn(id),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userIndustries = pgTable(
  "user_industries",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    industryId: text("industry_id")
      .notNull()
      .references(() => industries.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.industryId] }), index("user_industries_industry_idx").on(t.industryId)],
);

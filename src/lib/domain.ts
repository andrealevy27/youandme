/**
 * Domain vocabulary shared by the database schema, validation, server logic and UI.
 * Adding a value here (and a migration for enum-backed columns) is the only step
 * needed to extend a vocabulary.
 */

type Labels<T extends readonly string[]> = Record<T[number], string>;

export const INTENTS = ["building", "cofounder", "join", "consult", "advise", "exploring"] as const;
export type Intent = (typeof INTENTS)[number];
export const INTENT_LABELS: Labels<typeof INTENTS> = {
  building: "I'm building a startup",
  cofounder: "I'm looking for a cofounder",
  join: "I want to join a startup",
  consult: "I offer consulting services",
  advise: "I want to advise founders",
  exploring: "I'm exploring",
};

/** Roles a person can hold on the platform. Text-backed so new roles need no migration. */
export const USER_ROLES = ["founder", "cofounder_candidate", "consultant", "advisor", "freelancer", "talent"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const USER_ROLE_LABELS: Labels<typeof USER_ROLES> = {
  founder: "Founder",
  cofounder_candidate: "Cofounder candidate",
  consultant: "Consultant",
  advisor: "Advisor",
  freelancer: "Freelancer",
  talent: "Startup talent",
};

export const INTENT_TO_ROLES: Record<Intent, UserRole[]> = {
  building: ["founder"],
  cofounder: ["cofounder_candidate"],
  join: ["talent"],
  consult: ["consultant"],
  advise: ["advisor"],
  exploring: [],
};

export const STARTUP_STAGES = [
  "idea",
  "validation",
  "prototype",
  "mvp",
  "pre_revenue",
  "revenue",
  "growth",
  "fundraising",
] as const;
export type StartupStage = (typeof STARTUP_STAGES)[number];
export const STAGE_LABELS: Labels<typeof STARTUP_STAGES> = {
  idea: "Idea",
  validation: "Validation",
  prototype: "Prototype",
  mvp: "MVP",
  pre_revenue: "Pre-revenue",
  revenue: "Revenue",
  growth: "Growth",
  fundraising: "Fundraising",
};

export const COMMITMENTS = ["exploring", "part_time", "full_time_soon", "full_time"] as const;
export type Commitment = (typeof COMMITMENTS)[number];
export const COMMITMENT_LABELS: Labels<typeof COMMITMENTS> = {
  exploring: "Exploring",
  part_time: "Part-time",
  full_time_soon: "Full-time within 3 months",
  full_time: "Full-time now",
};

export const AVAILABILITY = ["full_time", "part_time", "nights_weekends", "limited"] as const;
export type Availability = (typeof AVAILABILITY)[number];
export const AVAILABILITY_LABELS: Labels<typeof AVAILABILITY> = {
  full_time: "40+ hrs / week",
  part_time: "15–30 hrs / week",
  nights_weekends: "Nights & weekends",
  limited: "A few hours / week",
};

export const WORK_MODES = ["remote", "hybrid", "in_person", "flexible"] as const;
export type WorkMode = (typeof WORK_MODES)[number];
export const WORK_MODE_LABELS: Labels<typeof WORK_MODES> = {
  remote: "Remote",
  hybrid: "Hybrid",
  in_person: "In person",
  flexible: "Flexible",
};

export const AMBITIONS = ["venture_scale", "profitable_independent", "impact", "open"] as const;
export type Ambition = (typeof AMBITIONS)[number];
export const AMBITION_LABELS: Labels<typeof AMBITIONS> = {
  venture_scale: "Venture-scale company",
  profitable_independent: "Profitable, independent business",
  impact: "Mission / impact first",
  open: "Open — depends on the idea",
};

export const FOUNDER_EXPERIENCE = ["first_time", "previous_founder", "serial", "exited"] as const;
export type FounderExperience = (typeof FOUNDER_EXPERIENCE)[number];
export const FOUNDER_EXPERIENCE_LABELS: Labels<typeof FOUNDER_EXPERIENCE> = {
  first_time: "First-time founder",
  previous_founder: "Founded before",
  serial: "Serial founder",
  exited: "Founder with an exit",
};

export const COFOUNDER_TYPES = ["technical", "business", "product", "design", "growth", "domain_expert"] as const;
export type CofounderType = (typeof COFOUNDER_TYPES)[number];
export const COFOUNDER_TYPE_LABELS: Labels<typeof COFOUNDER_TYPES> = {
  technical: "Technical",
  business: "Business",
  product: "Product",
  design: "Design",
  growth: "Growth & marketing",
  domain_expert: "Domain expert",
};

/** Skill categories; `COFOUNDER_TYPE_SKILL_CATEGORIES` maps what a cofounder type actually brings. */
export const SKILL_CATEGORIES = [
  "engineering",
  "ai_ml",
  "design",
  "product",
  "growth",
  "sales",
  "business",
  "finance",
  "legal",
  "operations",
  "domain",
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];
export const SKILL_CATEGORY_LABELS: Labels<typeof SKILL_CATEGORIES> = {
  engineering: "Engineering",
  ai_ml: "AI & ML",
  design: "Design",
  product: "Product",
  growth: "Growth & marketing",
  sales: "Sales",
  business: "Business & strategy",
  finance: "Finance & fundraising",
  legal: "Legal",
  operations: "Operations",
  domain: "Domain expertise",
};

export const COFOUNDER_TYPE_SKILL_CATEGORIES: Record<CofounderType, SkillCategory[]> = {
  technical: ["engineering", "ai_ml"],
  business: ["business", "sales", "finance", "operations"],
  product: ["product"],
  design: ["design"],
  growth: ["growth", "sales"],
  domain_expert: ["domain"],
};

export const STARTUP_MEMBER_ROLES = ["founder", "cofounder", "employee", "advisor", "contractor"] as const;
export type StartupMemberRole = (typeof STARTUP_MEMBER_ROLES)[number];
export const STARTUP_MEMBER_ROLE_LABELS: Labels<typeof STARTUP_MEMBER_ROLES> = {
  founder: "Founder",
  cofounder: "Cofounder",
  employee: "Employee",
  advisor: "Advisor",
  contractor: "Contractor",
};

export const FUNDING_STATUSES = ["bootstrapped", "not_raising", "raising", "pre_seed", "seed", "series_a_plus"] as const;
export type FundingStatus = (typeof FUNDING_STATUSES)[number];
export const FUNDING_STATUS_LABELS: Labels<typeof FUNDING_STATUSES> = {
  bootstrapped: "Bootstrapped",
  not_raising: "Not raising",
  raising: "Raising now",
  pre_seed: "Pre-seed funded",
  seed: "Seed funded",
  series_a_plus: "Series A+",
};

export const BUSINESS_MODELS = ["b2b_saas", "b2c", "marketplace", "hardware", "fintech", "services", "other"] as const;
export const BUSINESS_MODEL_LABELS: Labels<typeof BUSINESS_MODELS> = {
  b2b_saas: "B2B SaaS",
  b2c: "Consumer",
  marketplace: "Marketplace",
  hardware: "Hardware",
  fintech: "Fintech",
  services: "Services",
  other: "Other",
};

export const NEED_TYPES = ["cofounder", "consultant", "advisor", "employee", "freelancer", "other"] as const;
export type NeedType = (typeof NEED_TYPES)[number];
export const NEED_TYPE_LABELS: Labels<typeof NEED_TYPES> = {
  cofounder: "Cofounder",
  consultant: "Consultant",
  advisor: "Advisor",
  employee: "Early employee",
  freelancer: "Freelancer",
  other: "Other help",
};

export const PRICING_TYPES = ["fixed", "hourly", "package", "recurring"] as const;
export type PricingType = (typeof PRICING_TYPES)[number];
export const PRICING_TYPE_LABELS: Labels<typeof PRICING_TYPES> = {
  fixed: "Fixed price",
  hourly: "Hourly",
  package: "Package",
  recurring: "Monthly retainer",
};

export const BOOKING_STATUSES = ["pending_payment", "confirmed", "completed", "cancelled", "refunded", "disputed"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "confirmed", "completed", "refunded", "disputed", "cancelled"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CONVERSATION_TYPES = ["direct", "match", "consultant", "startup_group", "booking"] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export const VISIBILITY = ["public", "members", "hidden"] as const;
export type Visibility = (typeof VISIBILITY)[number];
export const VISIBILITY_LABELS: Labels<typeof VISIBILITY> = {
  public: "Anyone on You&Me",
  members: "Only people I'm connected or matched with",
  hidden: "Hidden from discovery and recommendations",
};

export const ACCOUNT_STATUSES = ["active", "suspended", "banned", "deleted"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const VERIFICATION_TYPES = ["email", "phone", "university_email", "linkedin", "identity"] as const;
export type VerificationType = (typeof VERIFICATION_TYPES)[number];
/** Deliberately modest wording — a badge only claims what was actually checked. */
export const VERIFICATION_LABELS: Labels<typeof VERIFICATION_TYPES> = {
  email: "Email confirmed",
  phone: "Phone confirmed",
  university_email: "University email confirmed",
  linkedin: "LinkedIn linked",
  identity: "Identity reviewed by You&Me",
};

export const REPORT_TARGETS = ["user", "message", "consultant", "startup", "review"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export const REPORT_REASONS = ["spam", "harassment", "impersonation", "inappropriate", "scam", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Labels<typeof REPORT_REASONS> = {
  spam: "Spam",
  harassment: "Harassment or abuse",
  impersonation: "Fake profile or impersonation",
  inappropriate: "Inappropriate content",
  scam: "Scam or fraud",
  other: "Something else",
};

export const SAVE_TARGETS = ["user", "consultant", "startup"] as const;
export type SaveTarget = (typeof SAVE_TARGETS)[number];

export const NOTIFICATION_TYPES = [
  "new_match",
  "new_message",
  "booking",
  "booking_reminder",
  "consultant_recommendation",
  "connection_request",
  "startup_invite",
  "review_request",
  "profile_view",
  "ai_recommendation",
  "system",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const NOTIFICATION_TYPE_LABELS: Labels<typeof NOTIFICATION_TYPES> = {
  new_match: "New matches",
  new_message: "New messages",
  booking: "Booking updates",
  booking_reminder: "Booking reminders",
  consultant_recommendation: "Consultant recommendations",
  connection_request: "Connection requests",
  startup_invite: "Startup invites",
  review_request: "Review requests",
  profile_view: "Profile views",
  ai_recommendation: "You&Me AI suggestions",
  system: "Account & security",
};

export const ADMIN_ROLES = ["super_admin", "moderator", "support", "finance", "ops"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

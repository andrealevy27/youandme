CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended', 'banned', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('super_admin', 'moderator', 'support', 'finance', 'ops');--> statement-breakpoint
CREATE TYPE "public"."ai_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."ambition" AS ENUM('venture_scale', 'profitable_independent', 'impact', 'open');--> statement-breakpoint
CREATE TYPE "public"."availability" AS ENUM('full_time', 'part_time', 'nights_weekends', 'limited');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending_payment', 'confirmed', 'completed', 'cancelled', 'refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."commitment" AS ENUM('exploring', 'part_time', 'full_time_soon', 'full_time');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('pending', 'accepted', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."consultant_status" AS ENUM('draft', 'pending_review', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."conversation_type" AS ENUM('direct', 'match', 'consultant', 'startup_group', 'booking');--> statement-breakpoint
CREATE TYPE "public"."follow_target" AS ENUM('user', 'startup');--> statement-breakpoint
CREATE TYPE "public"."founder_experience" AS ENUM('first_time', 'previous_founder', 'serial', 'exited');--> statement-breakpoint
CREATE TYPE "public"."funding_status" AS ENUM('bootstrapped', 'not_raising', 'raising', 'pre_seed', 'seed', 'series_a_plus');--> statement-breakpoint
CREATE TYPE "public"."interest_kind" AS ENUM('interested', 'passed');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'declined', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('text', 'image', 'file', 'system');--> statement-breakpoint
CREATE TYPE "public"."need_status" AS ENUM('open', 'paused', 'fulfilled', 'closed');--> statement-breakpoint
CREATE TYPE "public"."need_type" AS ENUM('cofounder', 'consultant', 'advisor', 'employee', 'freelancer', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'confirmed', 'completed', 'refunded', 'disputed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pricing_type" AS ENUM('fixed', 'hourly', 'package', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."recommendation_action" AS ENUM('none', 'passed', 'saved', 'interested');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'harassment', 'impersonation', 'inappropriate', 'scam', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewing', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target" AS ENUM('user', 'message', 'consultant', 'startup', 'review');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('published', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."save_target" AS ENUM('user', 'consultant', 'startup');--> statement-breakpoint
CREATE TYPE "public"."startup_member_role" AS ENUM('founder', 'cofounder', 'employee', 'advisor', 'contractor');--> statement-breakpoint
CREATE TYPE "public"."startup_stage" AS ENUM('idea', 'validation', 'prototype', 'mvp', 'pre_revenue', 'revenue', 'growth', 'fundraising');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."verification_type" AS ENUM('email', 'phone', 'university_email', 'linkedin', 'identity');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'members', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."waitlist_status" AS ENUM('waiting', 'invited', 'joined');--> statement-breakpoint
CREATE TYPE "public"."work_mode" AS ENUM('remote', 'hybrid', 'in_person', 'flexible');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "educations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"school" text NOT NULL,
	"degree" text,
	"field" text,
	"start_year" smallint,
	"end_year" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"description" text,
	"start_year" smallint,
	"end_year" smallint,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "industries" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "industries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"headline" text,
	"bio" text,
	"avatar_url" text,
	"location" text,
	"city" text,
	"country" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"university" text,
	"current_role" text,
	"current_company" text,
	"linkedin_url" text,
	"website_url" text,
	"github_url" text,
	"portfolio_url" text,
	"intents" text[] DEFAULT '{}'::text[] NOT NULL,
	"availability" "availability",
	"commitment" "commitment",
	"work_mode" "work_mode",
	"ambition" "ambition",
	"founder_experience" "founder_experience",
	"years_experience" smallint,
	"looking_for_cofounder" boolean DEFAULT false NOT NULL,
	"cofounder_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"stage_preferences" text[] DEFAULT '{}'::text[] NOT NULL,
	"equity_expectation" text,
	"looking_for" text,
	"goals" text,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"onboarding_step" integer DEFAULT 0 NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"suspended_until" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_industries" (
	"user_id" text NOT NULL,
	"industry_id" text NOT NULL,
	CONSTRAINT "user_industries_user_id_industry_id_pk" PRIMARY KEY("user_id","industry_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "user_skills" (
	"user_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"level" smallint DEFAULT 2 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_skills_user_id_skill_id_pk" PRIMARY KEY("user_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "need_skills" (
	"need_id" text NOT NULL,
	"skill_id" text NOT NULL,
	CONSTRAINT "need_skills_need_id_skill_id_pk" PRIMARY KEY("need_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "needs" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"startup_id" text,
	"type" "need_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"consultant_category_id" text,
	"commitment" "commitment",
	"budget_max_cents" integer,
	"status" "need_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"startup_id" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"commitment" "commitment",
	"location" text,
	"compensation" text,
	"equity" text,
	"is_open" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "startup_industries" (
	"startup_id" text NOT NULL,
	"industry_id" text NOT NULL,
	CONSTRAINT "startup_industries_startup_id_industry_id_pk" PRIMARY KEY("startup_id","industry_id")
);
--> statement-breakpoint
CREATE TABLE "startup_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"startup_id" text NOT NULL,
	"email" text,
	"invited_user_id" text,
	"role" "startup_member_role" NOT NULL,
	"make_admin" boolean DEFAULT false NOT NULL,
	"token" text NOT NULL,
	"invited_by_id" text,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "startup_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "startup_members" (
	"id" text PRIMARY KEY NOT NULL,
	"startup_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "startup_member_role" NOT NULL,
	"title" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "startups" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"tagline" text,
	"description" text,
	"problem" text,
	"solution" text,
	"stage" "startup_stage" DEFAULT 'idea' NOT NULL,
	"business_model" text,
	"founded_on" date,
	"location" text,
	"work_mode" "work_mode",
	"website_url" text,
	"pitch_deck_url" text,
	"traction" text,
	"funding_status" "funding_status",
	"funding_raised_cents" bigint,
	"team_size" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"created_by_id" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personality_answers" (
	"user_id" text NOT NULL,
	"question_id" text NOT NULL,
	"value" smallint NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personality_answers_user_id_question_id_pk" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "personality_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"scores" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personality_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"prompt" text NOT NULL,
	"topic" text NOT NULL,
	"dimension" text NOT NULL,
	"polarity" smallint NOT NULL,
	"order" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "personality_questions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "compatibility_results" (
	"id" text PRIMARY KEY NOT NULL,
	"user_a_id" text NOT NULL,
	"user_b_id" text NOT NULL,
	"score" smallint NOT NULL,
	"factors" jsonb NOT NULL,
	"frictions" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"algorithm_version" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interests" (
	"id" text PRIMARY KEY NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"kind" "interest_kind" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"location_scope" text DEFAULT 'anywhere' NOT NULL,
	"remote_ok" text DEFAULT 'yes' NOT NULL,
	"industry_ids" text[],
	"min_commitment" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_a_id" text NOT NULL,
	"user_b_id" text NOT NULL,
	"score" integer,
	"conversation_id" text,
	"unmatched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"for_date" date NOT NULL,
	"kind" text DEFAULT 'cofounder' NOT NULL,
	"rank" smallint NOT NULL,
	"score" smallint NOT NULL,
	"rank_score" real NOT NULL,
	"factors" jsonb NOT NULL,
	"frictions" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"reason" text NOT NULL,
	"action" "recommendation_action" DEFAULT 'none' NOT NULL,
	"viewed_at" timestamp with time zone,
	"acted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultant_availability" (
	"id" text PRIMARY KEY NOT NULL,
	"consultant_id" text NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultant_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consultant_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "consultant_portfolio_items" (
	"id" text PRIMARY KEY NOT NULL,
	"consultant_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultant_profile_categories" (
	"consultant_id" text NOT NULL,
	"category_id" text NOT NULL,
	CONSTRAINT "consultant_profile_categories_consultant_id_category_id_pk" PRIMARY KEY("consultant_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "consultant_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"headline" text NOT NULL,
	"bio" text,
	"years_experience" smallint,
	"hourly_rate_cents" integer,
	"currency" text DEFAULT 'usd' NOT NULL,
	"languages" text[] DEFAULT '{English}'::text[] NOT NULL,
	"previous_companies" text[] DEFAULT '{}'::text[] NOT NULL,
	"stages_served" text[] DEFAULT '{}'::text[] NOT NULL,
	"remote_available" boolean DEFAULT true NOT NULL,
	"accepting_clients" boolean DEFAULT true NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"min_notice_hours" smallint DEFAULT 24 NOT NULL,
	"status" "consultant_status" DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"rating_avg" real,
	"review_count" integer DEFAULT 0 NOT NULL,
	"engagement_count" integer DEFAULT 0 NOT NULL,
	"stripe_account_id" text,
	"stripe_charges_enabled" boolean DEFAULT false NOT NULL,
	"calendar_provider" text,
	"calendar_connection_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultant_services" (
	"id" text PRIMARY KEY NOT NULL,
	"consultant_id" text NOT NULL,
	"category_id" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"pricing_type" "pricing_type" NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"billing_interval" text,
	"includes" text[] DEFAULT '{}'::text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultant_time_off" (
	"id" text PRIMARY KEY NOT NULL,
	"consultant_id" text NOT NULL,
	"day" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_participants" (
	"booking_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"consultant_id" text NOT NULL,
	"client_id" text NOT NULL,
	"startup_id" text,
	"status" "booking_status" DEFAULT 'pending_payment' NOT NULL,
	"service_title" text NOT NULL,
	"pricing_type" "pricing_type" NOT NULL,
	"quantity" smallint DEFAULT 1 NOT NULL,
	"amount_cents" integer NOT NULL,
	"platform_fee_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"project_context" text,
	"conversation_id" text,
	"calendar_event_id" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_id" text,
	"cancel_reason" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"payer_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_checkout_id" text,
	"provider_payment_id" text,
	"provider_subscription_id" text,
	"amount_cents" integer NOT NULL,
	"application_fee_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"consultant_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"expertise" smallint NOT NULL,
	"communication" smallint NOT NULL,
	"value" smallint NOT NULL,
	"reliability" smallint NOT NULL,
	"overall" smallint NOT NULL,
	"body" text,
	"status" "review_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"last_read_at" timestamp with time zone,
	"typing_at" timestamp with time zone,
	"muted_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "conversation_members_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "conversation_type" NOT NULL,
	"title" text,
	"startup_id" text,
	"booking_id" text,
	"match_id" text,
	"direct_key" text,
	"created_by_id" text,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_direct_key_unique" UNIQUE("direct_key")
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_reactions_message_id_user_id_emoji_pk" PRIMARY KEY("message_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_id" text,
	"kind" "message_kind" DEFAULT 'text' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"attachments" jsonb,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_id" text NOT NULL,
	"addressee_id" text NOT NULL,
	"status" "connection_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" text NOT NULL,
	"target_type" "follow_target" NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_target_type_target_id_pk" PRIMARY KEY("follower_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"push" boolean DEFAULT false NOT NULL,
	CONSTRAINT "notification_preferences_user_id_type_pk" PRIMARY KEY("user_id","type")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"actor_id" text,
	"data" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_collections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"collection_id" text,
	"target_type" "save_target" NOT NULL,
	"target_id" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "identity_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "verification_type" NOT NULL,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"subject" text,
	"token_hash" text,
	"reviewed_by_id" text,
	"verified_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text,
	"target_type" "report_target" NOT NULL,
	"target_id" text NOT NULL,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"snapshot" jsonb,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by_id" text,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" "admin_role" NOT NULL,
	"granted_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"role" "ai_role" NOT NULL,
	"content" text NOT NULL,
	"cards" jsonb,
	"tool_trace" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"properties" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"email" text,
	"note" text,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"created_by_id" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_invites_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"provider_customer_id" text,
	"provider_subscription_id" text,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"intent" text,
	"note" text,
	"status" "waitlist_status" DEFAULT 'waiting' NOT NULL,
	"invite_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_entries_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "educations" ADD CONSTRAINT "educations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_industries" ADD CONSTRAINT "user_industries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_industries" ADD CONSTRAINT "user_industries_industry_id_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_skills" ADD CONSTRAINT "need_skills_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_skills" ADD CONSTRAINT "need_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "needs" ADD CONSTRAINT "needs_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "needs" ADD CONSTRAINT "needs_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_roles" ADD CONSTRAINT "open_roles_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_industries" ADD CONSTRAINT "startup_industries_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_industries" ADD CONSTRAINT "startup_industries_industry_id_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_invites" ADD CONSTRAINT "startup_invites_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_invites" ADD CONSTRAINT "startup_invites_invited_user_id_user_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_invites" ADD CONSTRAINT "startup_invites_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_members" ADD CONSTRAINT "startup_members_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_members" ADD CONSTRAINT "startup_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startups" ADD CONSTRAINT "startups_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personality_answers" ADD CONSTRAINT "personality_answers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personality_answers" ADD CONSTRAINT "personality_answers_question_id_personality_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."personality_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personality_profiles" ADD CONSTRAINT "personality_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compatibility_results" ADD CONSTRAINT "compatibility_results_user_a_id_user_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compatibility_results" ADD CONSTRAINT "compatibility_results_user_b_id_user_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interests" ADD CONSTRAINT "interests_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interests" ADD CONSTRAINT "interests_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_preferences" ADD CONSTRAINT "match_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_a_id_user_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_b_id_user_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_candidate_id_user_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_availability" ADD CONSTRAINT "consultant_availability_consultant_id_consultant_profiles_user_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."consultant_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_portfolio_items" ADD CONSTRAINT "consultant_portfolio_items_consultant_id_consultant_profiles_user_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."consultant_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_profile_categories" ADD CONSTRAINT "consultant_profile_categories_consultant_id_consultant_profiles_user_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."consultant_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_profile_categories" ADD CONSTRAINT "consultant_profile_categories_category_id_consultant_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."consultant_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_profiles" ADD CONSTRAINT "consultant_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_services" ADD CONSTRAINT "consultant_services_consultant_id_consultant_profiles_user_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."consultant_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_services" ADD CONSTRAINT "consultant_services_category_id_consultant_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."consultant_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_time_off" ADD CONSTRAINT "consultant_time_off_consultant_id_consultant_profiles_user_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."consultant_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_consultant_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."consultant_services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_consultant_id_consultant_profiles_user_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."consultant_profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_id_user_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_consultant_id_consultant_profiles_user_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."consultant_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_addressee_id_user_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_user_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_collections" ADD CONSTRAINT "saved_collections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_collection_id_saved_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."saved_collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_user_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_granted_by_id_user_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_thread_id_ai_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."ai_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_threads" ADD CONSTRAINT "ai_threads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invites" ADD CONSTRAINT "platform_invites_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_invite_id_platform_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."platform_invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "educations_user_idx" ON "educations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "experiences_user_idx" ON "experiences" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_handle_idx" ON "profiles" USING btree (lower("handle"));--> statement-breakpoint
CREATE INDEX "profiles_discovery_idx" ON "profiles" USING btree ("status","visibility","last_active_at");--> statement-breakpoint
CREATE INDEX "profiles_cofounder_idx" ON "profiles" USING btree ("looking_for_cofounder","status");--> statement-breakpoint
CREATE INDEX "profiles_search_idx" ON "profiles" USING gin (to_tsvector('english', coalesce("display_name",'') || ' ' || coalesce("headline",'') || ' ' || coalesce("bio",'') || ' ' || coalesce("university",'') || ' ' || coalesce("current_role",'') || ' ' || coalesce("current_company",'') || ' ' || coalesce("looking_for",'')));--> statement-breakpoint
CREATE INDEX "skills_category_idx" ON "skills" USING btree ("category");--> statement-breakpoint
CREATE INDEX "user_industries_industry_idx" ON "user_industries" USING btree ("industry_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role");--> statement-breakpoint
CREATE INDEX "user_skills_skill_idx" ON "user_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "needs_owner_idx" ON "needs" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "needs_startup_idx" ON "needs" USING btree ("startup_id","status");--> statement-breakpoint
CREATE INDEX "open_roles_startup_idx" ON "open_roles" USING btree ("startup_id");--> statement-breakpoint
CREATE INDEX "startup_invites_startup_idx" ON "startup_invites" USING btree ("startup_id");--> statement-breakpoint
CREATE INDEX "startup_invites_user_idx" ON "startup_invites" USING btree ("invited_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "startup_members_unique_idx" ON "startup_members" USING btree ("startup_id","user_id");--> statement-breakpoint
CREATE INDEX "startup_members_user_idx" ON "startup_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "startups_slug_idx" ON "startups" USING btree (lower("slug"));--> statement-breakpoint
CREATE INDEX "startups_stage_idx" ON "startups" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "startups_search_idx" ON "startups" USING gin (to_tsvector('english', coalesce("name",'') || ' ' || coalesce("tagline",'') || ' ' || coalesce("description",'') || ' ' || coalesce("problem",'') || ' ' || coalesce("solution",'')));--> statement-breakpoint
CREATE INDEX "personality_answers_user_idx" ON "personality_answers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "compat_pair_idx" ON "compatibility_results" USING btree ("user_a_id","user_b_id","algorithm_version");--> statement-breakpoint
CREATE UNIQUE INDEX "interests_pair_idx" ON "interests" USING btree ("from_user_id","to_user_id");--> statement-breakpoint
CREATE INDEX "interests_to_idx" ON "interests" USING btree ("to_user_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_pair_idx" ON "matches" USING btree ("user_a_id","user_b_id");--> statement-breakpoint
CREATE INDEX "matches_a_idx" ON "matches" USING btree ("user_a_id");--> statement-breakpoint
CREATE INDEX "matches_b_idx" ON "matches" USING btree ("user_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendations_unique_idx" ON "recommendations" USING btree ("user_id","candidate_id","for_date","kind");--> statement-breakpoint
CREATE INDEX "recommendations_user_date_idx" ON "recommendations" USING btree ("user_id","for_date");--> statement-breakpoint
CREATE INDEX "availability_consultant_idx" ON "consultant_availability" USING btree ("consultant_id","weekday");--> statement-breakpoint
CREATE INDEX "portfolio_consultant_idx" ON "consultant_portfolio_items" USING btree ("consultant_id");--> statement-breakpoint
CREATE INDEX "cpc_category_idx" ON "consultant_profile_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "consultant_profiles_status_idx" ON "consultant_profiles" USING btree ("status","accepting_clients");--> statement-breakpoint
CREATE INDEX "consultant_profiles_search_idx" ON "consultant_profiles" USING gin (to_tsvector('english', coalesce("headline",'') || ' ' || coalesce("bio",'')));--> statement-breakpoint
CREATE INDEX "services_consultant_idx" ON "consultant_services" USING btree ("consultant_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "time_off_unique_idx" ON "consultant_time_off" USING btree ("consultant_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_participants_idx" ON "booking_participants" USING btree ("booking_id","user_id");--> statement-breakpoint
CREATE INDEX "bp_user_idx" ON "booking_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookings_consultant_time_idx" ON "bookings" USING btree ("consultant_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_client_idx" ON "bookings" USING btree ("client_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_no_double_booking_idx" ON "bookings" USING btree ("consultant_id","starts_at") WHERE "bookings"."status" in ('pending_payment','confirmed');--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_checkout_idx" ON "payments" USING btree ("provider_checkout_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reviews_consultant_idx" ON "reviews" USING btree ("consultant_id","status");--> statement-breakpoint
CREATE INDEX "cm_user_idx" ON "conversation_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_startup_idx" ON "conversations" USING btree ("startup_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_pair_idx" ON "connections" USING btree ("requester_id","addressee_id");--> statement-breakpoint
CREATE INDEX "connections_addressee_idx" ON "connections" USING btree ("addressee_id","status");--> statement-breakpoint
CREATE INDEX "follows_target_idx" ON "follows" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "saved_collections_user_idx" ON "saved_collections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_items_unique_idx" ON "saved_items" USING btree ("user_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "saved_items_collection_idx" ON "saved_items" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "blocks_blocked_idx" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "verifications_user_idx" ON "identity_verifications" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "ai_messages_thread_idx" ON "ai_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_threads_user_idx" ON "ai_threads" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "analytics_name_idx" ON "analytics_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "analytics_user_idx" ON "analytics_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "file_uploads_user_idx" ON "file_uploads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "waitlist_status_idx" ON "waitlist_entries" USING btree ("status","created_at");
ALTER TABLE "profiles" ADD COLUMN "school" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "school_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "campus_scope" text DEFAULT 'all' NOT NULL;
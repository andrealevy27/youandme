CREATE TABLE "cofounder_trials" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"user_a_id" text NOT NULL,
	"user_b_id" text NOT NULL,
	"started_by" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"decision_a" text,
	"decision_b" text,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cofounder_trials" ADD CONSTRAINT "cofounder_trials_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cofounder_trials" ADD CONSTRAINT "cofounder_trials_user_a_id_user_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cofounder_trials" ADD CONSTRAINT "cofounder_trials_user_b_id_user_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cofounder_trials" ADD CONSTRAINT "cofounder_trials_started_by_user_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cofounder_trials_match_idx" ON "cofounder_trials" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "cofounder_trials_a_idx" ON "cofounder_trials" USING btree ("user_a_id");--> statement-breakpoint
CREATE INDEX "cofounder_trials_b_idx" ON "cofounder_trials" USING btree ("user_b_id");
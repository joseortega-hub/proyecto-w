CREATE TABLE "taste_profiles" (
	"user_id" text NOT NULL,
	"domain_id" text NOT NULL,
	"likes" text[] DEFAULT '{}'::text[] NOT NULL,
	"dislikes" text[] DEFAULT '{}'::text[] NOT NULL,
	"learned" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"feedback" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "taste_profiles_user_id_domain_id_pk" PRIMARY KEY("user_id","domain_id")
);
--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD COLUMN "taste" jsonb;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD COLUMN "text_signals" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "taste_profiles" ADD CONSTRAINT "taste_profiles_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;
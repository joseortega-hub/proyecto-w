ALTER TABLE "interview_sessions" ADD COLUMN "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "facets" jsonb DEFAULT '{}'::jsonb NOT NULL;
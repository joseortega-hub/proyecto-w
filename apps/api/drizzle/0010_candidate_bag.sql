ALTER TABLE "interview_sessions" ADD COLUMN "exclusions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD COLUMN "bag" jsonb;

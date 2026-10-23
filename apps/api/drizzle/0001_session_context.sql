ALTER TABLE "interview_sessions" ADD COLUMN "initial_text" text;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD COLUMN "context" jsonb DEFAULT '{}'::jsonb NOT NULL;
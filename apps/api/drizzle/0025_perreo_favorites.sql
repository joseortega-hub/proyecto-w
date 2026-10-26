ALTER TABLE "perreo_artists" ADD COLUMN IF NOT EXISTS "favorite_rank" integer;
--> statement-breakpoint
ALTER TABLE "perreo_artists" ADD COLUMN IF NOT EXISTS "profile" jsonb DEFAULT '{}'::jsonb NOT NULL;

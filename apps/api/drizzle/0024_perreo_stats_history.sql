ALTER TABLE "perreo_stats" ADD COLUMN IF NOT EXISTS "deezer_albums" integer;
--> statement-breakpoint
ALTER TABLE "perreo_stats" ADD COLUMN IF NOT EXISTS "fame" real;

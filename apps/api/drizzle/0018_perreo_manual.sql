ALTER TABLE "perreo_artists" ADD COLUMN "nickname" text;--> statement-breakpoint
ALTER TABLE "perreo_artists" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "perreo_artists" ADD COLUMN "featured_video_id" text;--> statement-breakpoint
ALTER TABLE "perreo_artists" ADD COLUMN "manual_fields" text[] DEFAULT '{}'::text[] NOT NULL;

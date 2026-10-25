ALTER TABLE "perreo_artists" ADD COLUMN "kind" text DEFAULT 'artist' NOT NULL;--> statement-breakpoint
ALTER TABLE "perreo_artists" ADD COLUMN "incomplete" boolean DEFAULT false NOT NULL;
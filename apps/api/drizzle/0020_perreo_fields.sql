ALTER TABLE "perreo_artists" ADD COLUMN "street_level" integer;--> statement-breakpoint
ALTER TABLE "perreo_artists" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "perreo_artists" ADD COLUMN "active_until" integer;--> statement-breakpoint
ALTER TABLE "perreo_artists" ADD COLUMN "aliases" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "perreo_artists" ADD COLUMN "collaborators" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "perreo_artists" ADD COLUMN "color" text;

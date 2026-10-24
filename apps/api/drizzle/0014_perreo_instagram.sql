CREATE TABLE "perreo_review" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"reason" text NOT NULL,
	"listeners" integer,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"mbid" text,
	"qid" text,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "perreo_artists" ADD COLUMN "source" text DEFAULT 'urbanopedia' NOT NULL;--> statement-breakpoint
ALTER TABLE "perreo_artists" ADD COLUMN "followed" boolean DEFAULT false NOT NULL;
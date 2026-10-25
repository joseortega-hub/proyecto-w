CREATE TABLE IF NOT EXISTS "perreo_releases" (
	"id" text PRIMARY KEY NOT NULL,
	"artist_slug" text NOT NULL,
	"kind" text NOT NULL,
	"record_type" text,
	"title" text NOT NULL,
	"release_date" text NOT NULL,
	"cover_url" text,
	"link" text,
	"source" text NOT NULL,
	"fans" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "perreo_releases_date_idx" ON "perreo_releases" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "perreo_releases_artist_idx" ON "perreo_releases" USING btree ("artist_slug");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "perreo_stats" (
	"artist_slug" text NOT NULL,
	"day" text NOT NULL,
	"lastfm_listeners" integer,
	"lastfm_plays" bigint,
	"deezer_fans" integer,
	"youtube_views" bigint,
	"youtube_subs" integer,
	"geo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "perreo_stats_artist_slug_day_pk" PRIMARY KEY("artist_slug","day")
);

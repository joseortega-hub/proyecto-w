CREATE TABLE "youtube_accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"channel_id" text,
	"channel_title" text,
	"refresh_token" text NOT NULL,
	"access_token" text,
	"access_expires_at" timestamp with time zone,
	"status" text DEFAULT 'connected' NOT NULL,
	"import_state" jsonb,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "items_source_uq";--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "owner_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "items_owner_idx" ON "items" USING btree ("domain_id","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_source_uq" ON "items" USING btree ("domain_id","source","external_id","owner_id");
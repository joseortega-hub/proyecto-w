CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "domain_attributes" (
	"domain_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"low_label" text,
	"high_label" text,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "domain_attributes_domain_id_key_pk" PRIMARY KEY("domain_id","key")
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"item_noun" text NOT NULL,
	"item_noun_plural" text NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" text NOT NULL,
	"status" text DEFAULT 'asking' NOT NULL,
	"turns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"profile" jsonb,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" text NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"description" text,
	"image_url" text,
	"media_url" text,
	"external_url" text,
	"duration_sec" integer,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"popularity" real DEFAULT 0 NOT NULL,
	"embedding" vector(768),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "domain_attributes" ADD CONSTRAINT "domain_attributes_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "items_source_uq" ON "items" USING btree ("domain_id","source","external_id");--> statement-breakpoint
CREATE INDEX "items_domain_idx" ON "items" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "items_tags_idx" ON "items" USING gin ("tags");
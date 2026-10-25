CREATE TABLE "seen_items" (
	"user_id" text NOT NULL,
	"domain_id" text NOT NULL,
	"item_id" uuid NOT NULL,
	"rating" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seen_items_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "seen_items" ADD CONSTRAINT "seen_items_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seen_items" ADD CONSTRAINT "seen_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seen_items_user_domain_idx" ON "seen_items" USING btree ("user_id","domain_id");

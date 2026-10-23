CREATE TABLE "question_bank" (
	"domain_id" text NOT NULL,
	"probe_id" text NOT NULL,
	"variant" integer NOT NULL,
	"intent" text NOT NULL,
	"question" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_bank_domain_id_probe_id_variant_pk" PRIMARY KEY("domain_id","probe_id","variant")
);
--> statement-breakpoint
ALTER TABLE "question_bank" ADD CONSTRAINT "question_bank_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;
CREATE TABLE "ai_traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"session_id" uuid,
	"domain_id" text,
	"task" text NOT NULL,
	"subject" text NOT NULL,
	"provider" text,
	"model" text,
	"ok" boolean NOT NULL,
	"skipped" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"latency_ms" integer NOT NULL,
	"total_ms" integer NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"list_cost_eur" real DEFAULT 0 NOT NULL,
	"free" boolean DEFAULT true NOT NULL,
	"outcome" text
);
--> statement-breakpoint
CREATE INDEX "ai_traces_session_idx" ON "ai_traces" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_traces_created_idx" ON "ai_traces" USING btree ("created_at");
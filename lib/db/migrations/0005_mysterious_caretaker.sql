CREATE TABLE IF NOT EXISTS "contract_ask_clusters" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"canonical_question" text NOT NULL,
	"ask_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_ask_turns" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text,
	"cluster_id" text NOT NULL,
	"question_raw" text NOT NULL,
	"portfolio_mode" boolean NOT NULL,
	"contract_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reference_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"response_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_ask_clusters" ADD CONSTRAINT "contract_ask_clusters_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_ask_turns" ADD CONSTRAINT "contract_ask_turns_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_ask_turns" ADD CONSTRAINT "contract_ask_turns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_ask_turns" ADD CONSTRAINT "contract_ask_turns_cluster_id_contract_ask_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."contract_ask_clusters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_ask_clusters_org_id_idx" ON "contract_ask_clusters" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_ask_clusters_org_ask_count_idx" ON "contract_ask_clusters" USING btree ("org_id","ask_count");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_ask_turns_org_id_idx" ON "contract_ask_turns" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_ask_turns_cluster_id_idx" ON "contract_ask_turns" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_ask_turns_cluster_created_idx" ON "contract_ask_turns" USING btree ("cluster_id","created_at");

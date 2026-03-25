CREATE TYPE "public"."training_course_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_course_contracts" (
	"course_id" text NOT NULL,
	"contract_id" text NOT NULL,
	CONSTRAINT "training_course_contracts_course_id_contract_id_pk" PRIMARY KEY("course_id","contract_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_course_documents" (
	"course_id" text NOT NULL,
	"document_id" text NOT NULL,
	CONSTRAINT "training_course_documents_course_id_document_id_pk" PRIMARY KEY("course_id","document_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_courses" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" "training_course_status" DEFAULT 'draft' NOT NULL,
	"gamma_generation_id" varchar(255),
	"gamma_url" text,
	"gamma_export_url" text,
	"gamma_status" varchar(50),
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_modules" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"title" varchar(500) NOT NULL,
	"body_markdown" text NOT NULL,
	"quiz_json" jsonb,
	"estimated_minutes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"module_id" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_course_contracts" ADD CONSTRAINT "training_course_contracts_course_id_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_course_contracts" ADD CONSTRAINT "training_course_contracts_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_course_documents" ADD CONSTRAINT "training_course_documents_course_id_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_course_documents" ADD CONSTRAINT "training_course_documents_document_id_contract_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."contract_documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_modules" ADD CONSTRAINT "training_modules_course_id_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_progress" ADD CONSTRAINT "training_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_progress" ADD CONSTRAINT "training_progress_module_id_training_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."training_modules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "training_courses_org_id_idx" ON "training_courses" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "training_courses_status_idx" ON "training_courses" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "training_modules_course_id_idx" ON "training_modules" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "training_progress_user_module_idx" ON "training_progress" USING btree ("user_id","module_id");
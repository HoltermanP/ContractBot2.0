CREATE TABLE IF NOT EXISTS "organisation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamptz DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "programme" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organisation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamptz DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organisation_id" uuid NOT NULL,
	"programme_id" uuid,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamptz DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"reference" text NOT NULL,
	"contract_type" text NOT NULL,
	"status" text DEFAULT 'concept' NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamptz DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_project" (
	"contract_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"role" text DEFAULT 'lead' NOT NULL,
	CONSTRAINT "contract_project_contract_id_project_id_pk" PRIMARY KEY("contract_id","project_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"contract_id" uuid NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"label" text,
	"valid_from" date,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamptz DEFAULT now(),
	CONSTRAINT "contract_version_contract_id_version_number_uq" UNIQUE("contract_id","version_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"contract_version_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamptz DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_clause" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"contract_document_id" uuid NOT NULL,
	"clause_type" text NOT NULL,
	"owner_party" text,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"content" text,
	"ai_label" text,
	"ai_risk_score" smallint,
	"created_at" timestamptz DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organisation" ADD CONSTRAINT "organisation_slug_unique" UNIQUE ("slug");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract" ADD CONSTRAINT "contract_reference_unique" UNIQUE ("reference");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "programme" ADD CONSTRAINT "programme_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project" ADD CONSTRAINT "project_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project" ADD CONSTRAINT "project_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_project" ADD CONSTRAINT "contract_project_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_project" ADD CONSTRAINT "contract_project_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_version" ADD CONSTRAINT "contract_version_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_document" ADD CONSTRAINT "contract_document_contract_version_id_contract_version_id_fk" FOREIGN KEY ("contract_version_id") REFERENCES "public"."contract_version"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_clause" ADD CONSTRAINT "contract_clause_contract_document_id_contract_document_id_fk" FOREIGN KEY ("contract_document_id") REFERENCES "public"."contract_document"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE OR REPLACE VIEW active_contract_version AS
SELECT cv.*, c.reference, c.contract_type, c.status AS contract_status
FROM contract_version cv
JOIN contract c ON c.id = cv.contract_id
WHERE cv.is_current = true;
--> statement-breakpoint
-- Backfill legacy contract-management data into the new hierarchy.
-- This keeps the migration idempotent enough for already-migrated rows.
DO $$
BEGIN
  -- 1) organisations -> organisation
  INSERT INTO organisation (id, name, slug, created_at)
  SELECT
    o.id::uuid,
    o.name,
    o.slug,
    o.created_at
  FROM organizations o
  WHERE o.id ~* '^[0-9a-fA-F-]{36}$'
  ON CONFLICT (id) DO NOTHING;

  -- 2) Ensure each new organisation has at least one default programme.
  INSERT INTO programme (organisation_id, name, status)
  SELECT
    org.id,
    'Standaardprogramma',
    'active'
  FROM organisation org
  WHERE NOT EXISTS (
    SELECT 1
    FROM programme p
    WHERE p.organisation_id = org.id
  );

  -- 3) projects -> project
  CREATE TEMP TABLE tmp_programme_per_org ON COMMIT DROP AS
  SELECT DISTINCT ON (p.organisation_id)
    p.organisation_id,
    p.id AS programme_id
  FROM programme p
  ORDER BY p.organisation_id, p.created_at NULLS FIRST, p.id;

  CREATE TEMP TABLE tmp_project_map ON COMMIT DROP AS
  SELECT
    p_old.id AS old_project_id,
    p_old.org_id::uuid AS organisation_id,
    p_old.name,
    p_old.status
  FROM projects p_old
  WHERE p_old.id ~* '^[0-9a-fA-F-]{36}$'
    AND p_old.org_id ~* '^[0-9a-fA-F-]{36}$';

  INSERT INTO project (id, organisation_id, programme_id, name, status)
  SELECT
    tpm.old_project_id::uuid,
    tpm.organisation_id,
    tppo.programme_id,
    tpm.name,
    COALESCE(tpm.status, 'active')
  FROM tmp_project_map tpm
  JOIN tmp_programme_per_org tppo ON tppo.organisation_id = tpm.organisation_id
  ON CONFLICT (id) DO NOTHING;

  -- 4) contracts -> contract
  CREATE TEMP TABLE tmp_contract_map ON COMMIT DROP AS
  SELECT
    c_old.id AS old_contract_id,
    c_old.project_id AS old_project_id,
    CASE
      WHEN c_old.contract_number IS NOT NULL AND length(trim(c_old.contract_number)) > 0
        THEN trim(c_old.contract_number)
      WHEN c_old.title IS NOT NULL AND length(trim(c_old.title)) > 0
        THEN left(trim(c_old.title), 100)
      ELSE 'legacy-' || c_old.id
    END AS reference,
    COALESCE(NULLIF(trim(c_old.contract_type), ''), 'legacy') AS contract_type,
    CASE
      WHEN c_old.status IN ('concept', 'actief', 'verlopen', 'gearchiveerd', 'verwijderd')
        THEN c_old.status
      ELSE 'concept'
    END AS status,
    c_old.start_date::date AS start_date,
    c_old.end_date::date AS end_date,
    c_old.created_at
  FROM contracts c_old
  WHERE c_old.id ~* '^[0-9a-fA-F-]{36}$';

  INSERT INTO contract (id, reference, contract_type, status, start_date, end_date, created_at)
  SELECT
    tcm.old_contract_id::uuid,
    tcm.reference,
    tcm.contract_type,
    tcm.status,
    tcm.start_date,
    tcm.end_date,
    tcm.created_at
  FROM tmp_contract_map tcm
  ON CONFLICT (id) DO NOTHING;

  -- 5) Legacy single-project link -> new M2M contract_project
  INSERT INTO contract_project (contract_id, project_id, role)
  SELECT
    tcm.old_contract_id::uuid,
    tcm.old_project_id::uuid,
    'lead'
  FROM tmp_contract_map tcm
  WHERE tcm.old_project_id IS NOT NULL
    AND tcm.old_project_id ~* '^[0-9a-fA-F-]{36}$'
    AND EXISTS (SELECT 1 FROM project p WHERE p.id = tcm.old_project_id::uuid)
  ON CONFLICT (contract_id, project_id) DO NOTHING;

  -- 6) Create baseline versions for every migrated contract.
  INSERT INTO contract_version (contract_id, version_number, label, valid_from, is_current, created_at)
  SELECT
    c.id,
    1,
    'Gemigreerde basisversie',
    c.start_date,
    true,
    COALESCE(c.created_at, now())
  FROM contract c
  WHERE NOT EXISTS (
    SELECT 1
    FROM contract_version cv
    WHERE cv.contract_id = c.id
  );

  -- 7) contract_documents -> contract_document (attach to baseline version)
  CREATE TEMP TABLE tmp_current_version ON COMMIT DROP AS
  SELECT DISTINCT ON (cv.contract_id)
    cv.contract_id,
    cv.id AS contract_version_id
  FROM contract_version cv
  WHERE cv.is_current = true
  ORDER BY cv.contract_id, cv.version_number DESC, cv.created_at DESC NULLS LAST;

  INSERT INTO contract_document (contract_version_id, doc_type, title, sort_order, created_at)
  SELECT
    tcv.contract_version_id,
    COALESCE(cd.file_type, 'legacy'),
    COALESCE(NULLIF(trim(cd.filename), ''), 'Legacy document'),
    row_number() OVER (PARTITION BY cd.contract_id ORDER BY cd.uploaded_at, cd.id) - 1,
    COALESCE(cd.uploaded_at, now())
  FROM contract_documents cd
  JOIN tmp_current_version tcv ON tcv.contract_id = cd.contract_id::uuid
  WHERE cd.contract_id ~* '^[0-9a-fA-F-]{36}$';

  -- 8) contract_obligations -> contract_clause
  --    Attach obligations to first document of current version; create a synthetic
  --    document when needed so no obligations are lost.
  CREATE TEMP TABLE tmp_first_document ON COMMIT DROP AS
  SELECT DISTINCT ON (d.contract_version_id)
    d.contract_version_id,
    d.id AS document_id
  FROM contract_document d
  ORDER BY d.contract_version_id, d.sort_order ASC, d.created_at ASC NULLS LAST, d.id ASC;

  INSERT INTO contract_document (contract_version_id, doc_type, title, sort_order, created_at)
  SELECT
    tcv.contract_version_id,
    'legacy-obligations',
    'Gemigreerde verplichtingen',
    9999,
    now()
  FROM tmp_current_version tcv
  WHERE EXISTS (
    SELECT 1
    FROM contract_obligations co
    WHERE co.contract_id ~* '^[0-9a-fA-F-]{36}$'
      AND co.contract_id::uuid = tcv.contract_id
  )
    AND NOT EXISTS (
      SELECT 1
      FROM tmp_first_document tfd
      WHERE tfd.contract_version_id = tcv.contract_version_id
    );

  TRUNCATE TABLE tmp_first_document;

  INSERT INTO tmp_first_document (contract_version_id, document_id)
  SELECT DISTINCT ON (d.contract_version_id)
    d.contract_version_id,
    d.id AS document_id
  FROM contract_document d
  ORDER BY d.contract_version_id, d.sort_order ASC, d.created_at ASC NULLS LAST, d.id ASC;

  INSERT INTO contract_clause (
    contract_document_id,
    clause_type,
    owner_party,
    due_date,
    status,
    content,
    ai_label,
    ai_risk_score,
    created_at
  )
  SELECT
    tfd.document_id,
    COALESCE(NULLIF(trim(co.category::text), ''), 'other'),
    NULL,
    co.due_date::date,
    CASE
      WHEN co.status::text IN ('open', 'in_progress', 'compliant', 'non_compliant')
        THEN co.status::text
      ELSE 'open'
    END,
    co.description,
    CASE
      WHEN co.extracted_by_ai = true THEN 'migrated-ai'
      ELSE NULL
    END,
    NULL,
    COALESCE(co.created_at, now())
  FROM contract_obligations co
  JOIN tmp_current_version tcv ON tcv.contract_id = co.contract_id::uuid
  JOIN tmp_first_document tfd ON tfd.contract_version_id = tcv.contract_version_id
  WHERE co.contract_id ~* '^[0-9a-fA-F-]{36}$';
END $$;

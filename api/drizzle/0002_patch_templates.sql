CREATE TABLE IF NOT EXISTS "patch_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "original_name" text NOT NULL,
  "storage_key" text NOT NULL UNIQUE,
  "mime_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "snapshot" bytea NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "patch_templates_created_at_idx" ON "patch_templates" ("created_at" DESC);

ALTER TABLE "stages" ADD COLUMN IF NOT EXISTS "default_patch_template_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stages_default_patch_template_id_patch_templates_id_fk'
  ) THEN
    ALTER TABLE "stages"
      ADD CONSTRAINT "stages_default_patch_template_id_patch_templates_id_fk"
      FOREIGN KEY ("default_patch_template_id") REFERENCES "patch_templates"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

INSERT INTO "patch_templates" ("name", "original_name", "storage_key", "mime_type", "byte_size", "snapshot")
SELECT s."name" || ' (migrated)', 'legacy.xlsx', 'patch-templates/migrated-' || s."id"::text || '.xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  COALESCE(octet_length(s."default_template_snapshot"), 0),
  s."default_template_snapshot"
FROM "stages" s
WHERE s."default_template_snapshot" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "patch_templates" pt
    WHERE pt."storage_key" = 'patch-templates/migrated-' || s."id"::text || '.xlsx'
  );

UPDATE "stages" s
SET "default_patch_template_id" = pt."id"
FROM "patch_templates" pt
WHERE pt."storage_key" = 'patch-templates/migrated-' || s."id"::text || '.xlsx'
  AND s."default_template_snapshot" IS NOT NULL;

ALTER TABLE "stages" DROP COLUMN IF EXISTS "default_template_snapshot";

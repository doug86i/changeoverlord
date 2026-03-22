-- Replace Yjs bytea snapshots with JSON workbooks (clean break; dev/testing DB reset expected).

DROP TABLE IF EXISTS "performance_yjs_snapshots";

CREATE TABLE "performance_workbooks" (
  "performance_id" uuid PRIMARY KEY NOT NULL REFERENCES "performances"("id") ON DELETE CASCADE,
  "sheets_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "patch_templates" DROP COLUMN IF EXISTS "snapshot";
ALTER TABLE "patch_templates" ADD COLUMN "sheets_json" jsonb NOT NULL DEFAULT '[]'::jsonb;

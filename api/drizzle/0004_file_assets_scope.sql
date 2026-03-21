ALTER TABLE "file_assets" ADD COLUMN IF NOT EXISTS "performance_id" uuid REFERENCES "performances"("id") ON DELETE SET NULL;
ALTER TABLE "file_assets" ADD COLUMN IF NOT EXISTS "parent_file_id" uuid REFERENCES "file_assets"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "file_assets_performance_id_idx" ON "file_assets" ("performance_id");
CREATE INDEX IF NOT EXISTS "file_assets_parent_file_id_idx" ON "file_assets" ("parent_file_id");

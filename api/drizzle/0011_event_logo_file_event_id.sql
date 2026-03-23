ALTER TABLE "file_assets" ADD COLUMN IF NOT EXISTS "event_id" uuid REFERENCES "events"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "file_assets_event_id_idx" ON "file_assets" ("event_id");

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "logo_file_id" uuid REFERENCES "file_assets"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "stages_event_id_idx" ON "stages" ("event_id");
CREATE INDEX IF NOT EXISTS "stage_days_stage_id_idx" ON "stage_days" ("stage_id");
CREATE INDEX IF NOT EXISTS "performances_stage_day_id_idx" ON "performances" ("stage_day_id");
CREATE INDEX IF NOT EXISTS "file_assets_stage_id_idx" ON "file_assets" ("stage_id");

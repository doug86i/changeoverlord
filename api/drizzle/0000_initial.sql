CREATE TABLE IF NOT EXISTS "settings" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "password_hash" text,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "settings_singleton" CHECK ("id" = 1)
);

INSERT INTO "settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "stages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "default_template_snapshot" bytea
);

CREATE TABLE IF NOT EXISTS "stage_days" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stage_id" uuid NOT NULL REFERENCES "stages"("id") ON DELETE CASCADE,
  "day_date" date NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "stage_days_stage_day_unique" ON "stage_days" ("stage_id", "day_date");

CREATE TABLE IF NOT EXISTS "performances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stage_day_id" uuid NOT NULL REFERENCES "stage_days"("id") ON DELETE CASCADE,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "band_name" text NOT NULL DEFAULT '',
  "notes" text DEFAULT '',
  "start_time" text NOT NULL,
  "end_time" text
);

CREATE TABLE IF NOT EXISTS "performance_yjs_snapshots" (
  "performance_id" uuid PRIMARY KEY NOT NULL REFERENCES "performances"("id") ON DELETE CASCADE,
  "snapshot" bytea NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

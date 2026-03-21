CREATE TABLE IF NOT EXISTS "file_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "original_name" text NOT NULL,
  "storage_key" text NOT NULL UNIQUE,
  "mime_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "purpose" text NOT NULL,
  "stage_id" uuid REFERENCES "stages"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

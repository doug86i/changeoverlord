CREATE TABLE "stage_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"stage_id" uuid,
	"scope" text NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stage_chat_messages_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "stage_chat_messages_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "stage_chat_messages_scope_chk" CHECK ("scope" IN ('stage', 'event')),
	CONSTRAINT "stage_chat_messages_stage_scope_chk" CHECK (
		("scope" = 'event' AND "stage_id" IS NULL)
		OR ("scope" = 'stage' AND "stage_id" IS NOT NULL)
	)
);
--> statement-breakpoint
CREATE INDEX "stage_chat_messages_event_created_idx" ON "stage_chat_messages" ("event_id", "created_at");--> statement-breakpoint
CREATE INDEX "stage_chat_messages_stage_created_idx" ON "stage_chat_messages" ("stage_id", "created_at");

import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  date,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/** Single-row app configuration (id must always be 1). */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  passwordHash: text("password_hash"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  /** Optional client / festival logo (`file_assets` with `event_id` set). */
  logoFileId: uuid("logo_file_id").references((): AnyPgColumn => fileAssets.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Patch/RF workbook templates.
 * `stage_id IS NULL` → global (managed in Settings, available to all stages).
 * `stage_id` set   → local to that stage (managed on the stage page).
 */
export const patchTemplates = pgTable("patch_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  originalName: text("original_name").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  sheetsJson: jsonb("sheets_json")
    .notNull()
    .default(sql`'[]'::jsonb`),
  /** NULL = global template; set = local to this stage. */
  stageId: uuid("stage_id").references((): AnyPgColumn => stages.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const stages = pgTable("stages", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  /** Which stored template seeds new performances on this stage (null until operator selects one). */
  defaultPatchTemplateId: uuid("default_patch_template_id").references(
    () => patchTemplates.id,
    { onDelete: "set null" },
  ),
  /** Urgent line shown on all clock displays for this stage (stage manager; SSE-synced). */
  clockMessage: text("clock_message"),
});

export const stageDays = pgTable("stage_days", {
  id: uuid("id").defaultRandom().primaryKey(),
  stageId: uuid("stage_id")
    .notNull()
    .references(() => stages.id, { onDelete: "cascade" }),
  dayDate: date("day_date", { mode: "string" }).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const performances = pgTable("performances", {
  id: uuid("id").defaultRandom().primaryKey(),
  stageDayId: uuid("stage_day_id")
    .notNull()
    .references(() => stageDays.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").default(0).notNull(),
  bandName: text("band_name").notNull().default(""),
  notes: text("notes").default(""),
  /** Local event time as HH:mm (24h). */
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
});

/** Uploaded files (riders, plots, PDFs, etc.). */
export const fileAssets = pgTable("file_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  originalName: text("original_name").notNull(),
  /** Path relative to uploads root, e.g. files/<uuid>.pdf */
  storageKey: text("storage_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  /** rider_pdf, plot_pdf (stage plot / single-page extract), generic (other) */
  purpose: text("purpose").notNull(),
  stageId: uuid("stage_id").references(() => stages.id, { onDelete: "set null" }),
  /** Event-scoped uploads (e.g. client logo). Mutually exclusive with stage/performance scope in routes. */
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
  performanceId: uuid("performance_id").references(() => performances.id, {
    onDelete: "set null",
  }),
  /** Set when this file was extracted from another PDF (single-page derivative). */
  parentFileId: uuid("parent_file_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Latest FortuneSheet workbook (JSON) per performance. */
export const performanceWorkbooks = pgTable("performance_workbooks", {
  performanceId: uuid("performance_id")
    .primaryKey()
    .references(() => performances.id, { onDelete: "cascade" }),
  sheetsJson: jsonb("sheets_json")
    .notNull()
    .default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Stage-scoped or event-wide operator chat (LAN session). */
export const stageChatMessages = pgTable("stage_chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  stageId: uuid("stage_id").references(() => stages.id, { onDelete: "cascade" }),
  /** `stage` = one stage thread; `event` = visible on every stage in the event. */
  scope: text("scope").notNull(),
  author: text("author").notNull().default(""),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

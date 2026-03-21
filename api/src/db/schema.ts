import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  date,
  customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value: Buffer): Buffer {
    return value;
  },
  fromDriver(value: Buffer): Buffer {
    return value;
  },
});

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
  createdAt: timestamp("created_at", { withTimezone: true })
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
  /** Optional Yjs snapshot for the stage default patch workbook (cloned to new performances). */
  defaultTemplateSnapshot: bytea("default_template_snapshot"),
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

/** Latest Yjs snapshot per performance (FortuneSheet doc). */
export const performanceYjsSnapshots = pgTable("performance_yjs_snapshots", {
  performanceId: uuid("performance_id")
    .primaryKey()
    .references(() => performances.id, { onDelete: "cascade" }),
  snapshot: bytea("snapshot").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

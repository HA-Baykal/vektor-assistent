import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  date,
  time,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().default("Предприниматель"),
  morningTime: time("morning_time").notNull().default("07:00:00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(1),
  date: date("date").notNull(),
  time: time("time"),
  text: text("text").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(1),
  dealNumber: integer("deal_number").notNull().default(0), // Серийный номер сделки
  date: date("date").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  saleAmount: integer("sale_amount").notNull().default(0),
  purchaseAmount: integer("purchase_amount").notNull().default(0),
  workAmount: integer("work_amount").notNull().default(0),
  materialsAmount: integer("materials_amount").notNull().default(0),
  equipmentMargin: integer("equipment_margin").notNull().default(0),
  workMargin: integer("work_margin").notNull().default(0),
  totalMargin: integer("total_margin").notNull().default(0),
  notes: text("notes"),
  activityLog: text("activity_log").notNull().default("[]"), // JSON-массив действий
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

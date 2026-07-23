import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  date,
  time,
  boolean,
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
  dealNumber: integer("deal_number").notNull().default(0),
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
  activityLog: text("activity_log").notNull().default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Telegram пользователи
export const allowedUsers = pgTable("allowed_users", {
  id: serial("id").primaryKey(),
  chatId: varchar("chat_id", { length: 100 }).notNull().unique(),
  userName: varchar("user_name", { length: 255 }).default(""),
  accessLevel: varchar("access_level", { length: 20 }).notNull().default("read"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Постоянные коды доступа к веб-приложению
export const inviteCodes = pgTable("invite_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  label: varchar("label", { length: 255 }).default(""),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

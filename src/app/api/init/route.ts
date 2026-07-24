import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Эндпоинт для создания и обновления таблиц в базе данных.
// Откройте эту страницу один раз после развёртывания: /api/init
export async function GET() {
  const logs: string[] = [];
  
  try {
    // Создаём таблицы, если их ещё нет
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL DEFAULT 'Предприниматель',
        morning_time TIME NOT NULL DEFAULT '07:00:00',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    logs.push("✅ users — OK");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL DEFAULT 1,
        date DATE NOT NULL,
        time TIME,
        text TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    logs.push("✅ tasks — OK");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS deals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL DEFAULT 1,
        date DATE NOT NULL,
        category VARCHAR(50) NOT NULL,
        sale_amount INTEGER NOT NULL DEFAULT 0,
        purchase_amount INTEGER NOT NULL DEFAULT 0,
        work_amount INTEGER NOT NULL DEFAULT 0,
        materials_amount INTEGER NOT NULL DEFAULT 0,
        equipment_margin INTEGER NOT NULL DEFAULT 0,
        work_margin INTEGER NOT NULL DEFAULT 0,
        total_margin INTEGER NOT NULL DEFAULT 0,
        deal_number INTEGER NOT NULL DEFAULT 0,
        activity_log TEXT NOT NULL DEFAULT '[]',
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    logs.push("✅ deals — OK");

    // Добавляем новые колонки через сырой SQL
    try {
      await db.execute(sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_number INTEGER NOT NULL DEFAULT 0`);
      logs.push(`✅ Колонка deal_number добавлена`);
    } catch {
      logs.push(`ℹ️ Колонка deal_number уже существует`);
    }
    try {
      await db.execute(sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS activity_log TEXT NOT NULL DEFAULT '[]'`);
      logs.push(`✅ Колонка activity_log добавлена`);
    } catch {
      logs.push(`ℹ️ Колонка activity_log уже существует`);
    }

    // Устанавливаем deal_number для старых записей, у которых его нет
    await db.execute(sql`
      UPDATE deals SET deal_number = id WHERE deal_number = 0 OR deal_number IS NULL
    `);
    logs.push("✅ Номера сделок установлены для старых записей");

    // Таблица разрешений для Telegram бота
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS allowed_users (
        id SERIAL PRIMARY KEY,
        chat_id VARCHAR(100) NOT NULL UNIQUE,
        user_name VARCHAR(255) DEFAULT '',
        access_level VARCHAR(20) NOT NULL DEFAULT 'read',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    logs.push("✅ allowed_users — OK");

    // Добавляем новые колонки для старых таблиц
    try {
      await db.execute(sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) NOT NULL DEFAULT 'cash'`);
      logs.push(`✅ Колонка payment_type добавлена`);
    } catch { logs.push(`ℹ️ Колонка payment_type уже существует`); }
    try {
      await db.execute(sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS tax_amount INTEGER NOT NULL DEFAULT 0`);
      logs.push(`✅ Колонка tax_amount добавлена`);
    } catch { logs.push(`ℹ️ Колонка tax_amount уже существует`); }
    try {
      await db.execute(sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS total_with_tax INTEGER NOT NULL DEFAULT 0`);
      logs.push(`✅ Колонка total_with_tax добавлена`);
    } catch { logs.push(`ℹ️ Колонка total_with_tax уже существует`); }

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invite_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) NOT NULL UNIQUE,
        label VARCHAR(255) DEFAULT '',
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    logs.push("✅ invite_codes — OK");

    // Проверяем, что таблицы работают
    const tasksCount = await db.execute(sql`SELECT COUNT(*) as count FROM tasks`);
    const dealsCount = await db.execute(sql`SELECT COUNT(*) as count FROM deals`);

    return NextResponse.json({
      success: true,
      message: "✅ База данных инициализирована! Таблицы и колонки обновлены.",
      logs,
      tasksCount: Number(tasksCount.rows[0].count),
      dealsCount: Number(dealsCount.rows[0].count),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "❌ Ошибка: " + error.message,
        logs,
        hint: "Убедитесь, что DATABASE_URL правильно настроен в Vercel → Settings → Environment Variables",
      },
      { status: 500 }
    );
  }
}

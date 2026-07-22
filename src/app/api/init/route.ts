import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Эндпоинт для создания таблиц в базе данных.
// Откройте эту страницу один раз после развёртывания: /api/init
export async function GET() {
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

    // Проверяем, что таблицы созданы
    const tasks = await db.execute(sql`SELECT COUNT(*) as count FROM tasks`);
    const deals = await db.execute(sql`SELECT COUNT(*) as count FROM deals`);

    return NextResponse.json({
      success: true,
      message: "✅ База данных инициализирована! Таблицы созданы.",
      tasksCount: Number(tasks.rows[0].count),
      dealsCount: Number(deals.rows[0].count),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "❌ Ошибка: " + error.message,
        hint: "Убедитесь, что DATABASE_URL правильно настроен в Vercel → Settings → Environment Variables",
      },
      { status: 500 }
    );
  }
}

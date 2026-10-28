
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const result = await db.query(
      "SELECT current_database() AS database, NOW() AS server_time"
    );

    return NextResponse.json({
      success: true,
      message: "PostgreSQL connection successful",
      database: result.rows[0].database,
      serverTime: result.rows[0].server_time,
    });
  } catch (error) {
    console.error("Database connection test failed:", error);

    return NextResponse.json(
      { success: false, message: "Could not connect to PostgreSQL" },
      { status: 500 }
    );
  }
}

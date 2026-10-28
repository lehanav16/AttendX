
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const user = await requireRole("faculty");

  if (!user) {
    return NextResponse.json(
      { success: false, message: "Faculty login required." },
      { status: 401 }
    );
  }

  try {
    const result = await db.query(
      `SELECT
         ar.id AS attendance_id,
         st.roll_number,
         st.full_name,
         ar.status,
         ar.marked_at,
         s.subject_code,
         s.subject_name,
         a.id AS session_id,
         a.started_at,
         a.status AS session_status
       FROM attendance_records ar
       JOIN attendance_sessions a ON a.id = ar.session_id
       JOIN subjects s ON s.id = a.subject_id
       JOIN students st ON st.id = ar.student_id
       WHERE a.faculty_id = $1
       ORDER BY ar.marked_at DESC
       LIMIT 500`,
      [user.profileId]
    );

    return NextResponse.json({
      success: true,
      attendance: result.rows,
    });
  } catch (error) {
    console.error("Faculty attendance history error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not load attendance history.",
      },
      { status: 500 }
    );
  }
}

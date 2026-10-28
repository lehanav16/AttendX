
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await requireRole("faculty");

  if (!user) {
    return NextResponse.json(
      { success: false, message: "Faculty login required." },
      { status: 401 }
    );
  }

  const sessionId = Number(
    new URL(request.url).searchParams.get("sessionId")
  );

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json(
      { success: false, message: "Choose a valid session." },
      { status: 400 }
    );
  }

  try {
    const owner = await db.query(
      `SELECT
         a.id,
         a.subject_id,
         s.subject_name,
         s.subject_code,
         a.started_at,
         a.expires_at,
         a.status
       FROM attendance_sessions a
       JOIN subjects s ON s.id = a.subject_id
       WHERE a.id = $1 AND a.faculty_id = $2`,
      [sessionId, user.profileId]
    );

    if (!owner.rowCount) {
      return NextResponse.json(
        { success: false, message: "Session not found." },
        { status: 404 }
      );
    }

    const records = await db.query(
      `SELECT
         st.roll_number,
         st.full_name,
         ar.marked_at
       FROM attendance_records ar
       JOIN students st ON st.id = ar.student_id
       WHERE ar.session_id = $1
       ORDER BY ar.marked_at`,
      [sessionId]
    );

    return NextResponse.json({
      success: true,
      session: owner.rows[0],
      attendance: records.rows,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { success: false, message: "Could not load attendance list." },
      { status: 500 }
    );
  }
}

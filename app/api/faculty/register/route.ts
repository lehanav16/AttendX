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

  const subjectId = Number(new URL(request.url).searchParams.get("subjectId"));
  if (!Number.isInteger(subjectId) || subjectId <= 0) {
    return NextResponse.json(
      { success: false, message: "Choose a valid subject." },
      { status: 400 }
    );
  }

  try {
    const subjectResult = await db.query(
      `SELECT id, subject_code, subject_name
       FROM subjects
       WHERE id = $1 AND faculty_id = $2`,
      [subjectId, user.profileId]
    );

    if (!subjectResult.rowCount) {
      return NextResponse.json(
        { success: false, message: "Subject not found." },
        { status: 404 }
      );
    }

    // Expired sessions are considered completed even if the faculty page was closed.
    await db.query(
      `UPDATE attendance_sessions
       SET status = 'closed'
       WHERE subject_id = $1 AND faculty_id = $2
         AND status = 'active' AND expires_at <= NOW()`,
      [subjectId, user.profileId]
    );

    const sessionsResult = await db.query(
      `SELECT id, started_at, status
       FROM attendance_sessions
       WHERE subject_id = $1 AND faculty_id = $2 AND status = 'closed'
       ORDER BY started_at ASC`,
      [subjectId, user.profileId]
    );

    const studentsResult = await db.query(
      `SELECT st.id, st.roll_number, st.full_name
       FROM enrollments e
       JOIN students st ON st.id = e.student_id
       WHERE e.subject_id = $1
       ORDER BY st.roll_number ASC`,
      [subjectId]
    );

    const sessionIds = sessionsResult.rows.map((session) => String(session.id));
    const recordsResult = await db.query(
      `SELECT session_id, student_id, marked_at
       FROM attendance_records
       WHERE session_id = ANY($1::bigint[])`,
      [sessionIds]
    );

    const attendanceByKey = new Map<string, string>();
    for (const record of recordsResult.rows) {
      attendanceByKey.set(
        `${record.session_id}:${record.student_id}`,
        record.marked_at
      );
    }

    const sessions = sessionsResult.rows.map((session) => ({
      id: Number(session.id),
      started_at: session.started_at,
      status: session.status,
    }));

    const students = studentsResult.rows.map((student) => {
      const attendance = sessions.map((session) => {
        const key = `${session.id}:${student.id}`;
        const markedAt = attendanceByKey.get(key) ?? null;
        return {
          sessionId: session.id,
          status: markedAt ? "Present" : "Absent",
          markedAt,
        };
      });
      const presentCount = attendance.filter((item) => item.status === "Present").length;
      return {
        roll_number: student.roll_number,
        full_name: student.full_name,
        attendance,
        presentCount,
        totalSessions: sessions.length,
        percentage: sessions.length ? Math.round((presentCount / sessions.length) * 100) : 0,
      };
    });

    return NextResponse.json({
      success: true,
      subject: subjectResult.rows[0],
      sessions,
      students,
    });
  } catch (error) {
    console.error("Faculty register error:", error);
    return NextResponse.json(
      { success: false, message: "Could not load subject register." },
      { status: 500 }
    );
  }
}

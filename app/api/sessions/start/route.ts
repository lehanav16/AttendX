import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export async function POST(request: Request) {
  const user = await requireRole("faculty");
  if (!user) return NextResponse.json({ success:false, message:"Faculty login required." }, { status:401 });
  const client = await db.connect();
  try {
    const body = await request.json();
    const subjectId = Number(body.subjectId);
    if (!Number.isInteger(subjectId) || subjectId <= 0) return NextResponse.json({success:false,message:"Choose a valid subject."},{status:400});
    const subject = await client.query(`SELECT id,faculty_id,subject_name,subject_code FROM subjects WHERE id=$1`,[subjectId]);
    if (!subject.rowCount) return NextResponse.json({success:false,message:"Subject not found."},{status:404});
    if (Number(subject.rows[0].faculty_id) !== user.profileId) return NextResponse.json({success:false,message:"You are not assigned to this subject."},{status:403});
    await client.query("BEGIN");
    await client.query(`UPDATE attendance_sessions SET status='closed' WHERE subject_id=$1 AND status='active'`,[subjectId]);
    const result = await client.query(`INSERT INTO attendance_sessions(subject_id,faculty_id,started_at,expires_at,status) VALUES($1,$2,NOW(),NOW()+INTERVAL '60 minutes','active') RETURNING id,subject_id,faculty_id,started_at,expires_at,status`,[subjectId,user.profileId]);
    await client.query("COMMIT");
    return NextResponse.json({success:true,session:{...result.rows[0],subject_name:subject.rows[0].subject_name,subject_code:subject.rows[0].subject_code}});
  } catch(error) { await client.query("ROLLBACK").catch(()=>{}); console.error(error); return NextResponse.json({success:false,message:"Could not start attendance session."},{status:500}); }
  finally { client.release(); }
}

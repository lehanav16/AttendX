import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export async function GET() {
 const user=await requireRole("student"); if(!user) return NextResponse.json({success:false,message:"Student login required."},{status:401});
 try { const result=await db.query(`SELECT s.id AS subject_id,s.subject_code,s.subject_name,s.semester,f.full_name AS faculty_name,a.id AS session_id,a.started_at,a.expires_at,a.status,EXISTS(SELECT 1 FROM attendance_records ar WHERE ar.session_id=a.id AND ar.student_id=$1) AS already_marked FROM enrollments e JOIN subjects s ON s.id=e.subject_id JOIN faculty f ON f.id=s.faculty_id LEFT JOIN LATERAL (SELECT aa.* FROM attendance_sessions aa WHERE aa.subject_id=s.id AND aa.status='active' AND aa.expires_at>NOW() ORDER BY aa.started_at DESC LIMIT 1) a ON TRUE WHERE e.student_id=$1 ORDER BY s.subject_code`,[user.profileId]); return NextResponse.json({success:true,sessions:result.rows}); }
 catch(error){console.error(error);return NextResponse.json({success:false,message:"Could not load enrolled subjects."},{status:500});}
}

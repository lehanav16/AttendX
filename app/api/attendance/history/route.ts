import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export async function GET() {
 const user=await requireRole("student"); if(!user) return NextResponse.json({success:false,message:"Student login required."},{status:401});
 try { const result=await db.query(`SELECT ar.id,ar.marked_at,ar.status,s.subject_code,s.subject_name,a.started_at FROM attendance_records ar JOIN attendance_sessions a ON a.id=ar.session_id JOIN subjects s ON s.id=a.subject_id WHERE ar.student_id=$1 ORDER BY ar.marked_at DESC LIMIT 100`,[user.profileId]); return NextResponse.json({success:true,attendance:result.rows}); }
 catch(error){console.error(error);return NextResponse.json({success:false,message:"Could not load attendance history."},{status:500});}
}

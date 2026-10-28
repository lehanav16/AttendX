import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export async function GET() {
 const user=await requireRole("faculty"); if(!user) return NextResponse.json({success:false,message:"Faculty login required."},{status:401});
 try { const result=await db.query(`SELECT s.id,s.subject_code,s.subject_name,s.semester,COUNT(e.student_id)::int AS enrolled_count FROM subjects s LEFT JOIN enrollments e ON e.subject_id=s.id WHERE s.faculty_id=$1 GROUP BY s.id ORDER BY s.semester,s.subject_code`,[user.profileId]); return NextResponse.json({success:true,subjects:result.rows}); }
 catch(error){console.error(error);return NextResponse.json({success:false,message:"Could not load your subjects."},{status:500});}
}

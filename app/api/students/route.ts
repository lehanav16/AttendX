import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET() {
 const user=await requireRole("faculty"); if(!user) return NextResponse.json({success:false,message:"Faculty login required."},{status:401});
 try { const result=await db.query(`SELECT st.roll_number,st.full_name,st.email,st.department,st.semester FROM students st JOIN enrollments e ON e.student_id=st.id JOIN subjects s ON s.id=e.subject_id WHERE s.faculty_id=$1 GROUP BY st.id ORDER BY st.roll_number`,[user.profileId]); return NextResponse.json({success:true,students:result.rows}); }
 catch(error){console.error(error);return NextResponse.json({success:false,message:"Could not fetch enrolled students."},{status:500});}
}

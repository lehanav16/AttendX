import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export async function POST(request: Request) {
  const user = await requireRole("student");
  if (!user) return NextResponse.json({success:false,message:"Please sign in with your student account."},{status:401});
  try {
    const body=await request.json(); const token=typeof body.token==="string"?body.token:"";
    const faceCheck=body.faceCheck===true; const capturedImage=typeof body.capturedImage==="string"?body.capturedImage:"";
    if(!token) return NextResponse.json({success:false,message:"Scan the current faculty QR code."},{status:400});
    if(!faceCheck||!capturedImage.startsWith("data:image/")) return NextResponse.json({success:false,message:"Complete the live camera face check before marking attendance."},{status:400});
    if(capturedImage.length>4_000_000) return NextResponse.json({success:false,message:"Image is too large. Retake the selfie."},{status:413});
    const secretValue=process.env.QR_SECRET; if(!secretValue||secretValue.length<32) return NextResponse.json({success:false,message:"QR_SECRET is not configured correctly."},{status:500});
    let claims; try { claims=(await jwtVerify(token,new TextEncoder().encode(secretValue),{algorithms:["HS256"]})).payload; } catch { return NextResponse.json({success:false,message:"QR code expired. Scan the current code again."},{status:400}); }
    const sessionId=Number(claims.sessionId), subjectId=Number(claims.subjectId), tokenWindow=Number(claims.window);
    if(!Number.isInteger(sessionId)||!Number.isInteger(subjectId)||!Number.isFinite(tokenWindow)||tokenWindow<Math.floor(Date.now()/1000)-12) return NextResponse.json({success:false,message:"QR code is stale or invalid. Scan the current code again."},{status:400});
    const studentId=user.profileId;
    const sessionResult=await db.query(`SELECT id,subject_id,status,expires_at FROM attendance_sessions WHERE id=$1`,[sessionId]);
    if(!sessionResult.rowCount) return NextResponse.json({success:false,message:"Attendance session not found."},{status:404});
    const session=sessionResult.rows[0];
    if(Number(session.subject_id)!==subjectId||session.status!=="active"||new Date(session.expires_at).getTime()<=Date.now()) return NextResponse.json({success:false,message:"This attendance session is no longer active."},{status:410});
    const enrollment=await db.query(`SELECT 1 FROM enrollments WHERE student_id=$1 AND subject_id=$2`,[studentId,subjectId]);
    if(!enrollment.rowCount) return NextResponse.json({success:false,message:"You are not enrolled in this subject."},{status:403});
    const inserted=await db.query(`INSERT INTO attendance_records(session_id,student_id,marked_at,status,face_check) VALUES($1,$2,NOW(),'present','camera-capture') ON CONFLICT(session_id,student_id) DO NOTHING RETURNING id,marked_at`,[sessionId,studentId]);
    if(!inserted.rowCount) return NextResponse.json({success:false,alreadyMarked:true,message:"Attendance has already been marked for this class session."},{status:409});
    const details=await db.query(`SELECT s.subject_name,s.subject_code FROM subjects s WHERE s.id=$1`,[subjectId]);
    return NextResponse.json({success:true,message:"Attendance recorded.",attendance:{studentName:user.fullName,rollNumber:user.rollNumber,subjectName:details.rows[0]?.subject_name,subjectCode:details.rows[0]?.subject_code,markedAt:inserted.rows[0].marked_at}});
  } catch(error){console.error("Mark attendance failed:",error);return NextResponse.json({success:false,message:"Could not mark attendance. Please try again."},{status:500});}
}

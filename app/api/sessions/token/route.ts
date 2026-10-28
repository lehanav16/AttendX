import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export async function POST(request: Request) {
  const user = await requireRole("faculty");
  if (!user) return NextResponse.json({success:false,message:"Faculty login required."},{status:401});
  try {
    const body=await request.json(); const sessionId=Number(body.sessionId);
    if(!Number.isInteger(sessionId)||sessionId<=0) return NextResponse.json({success:false,message:"A valid session is required."},{status:400});
    const secretValue=process.env.QR_SECRET;
    if(!secretValue||secretValue.length<32) return NextResponse.json({success:false,message:"Set QR_SECRET to a random secret of at least 32 characters."},{status:500});
    const result=await db.query(`SELECT a.id,a.subject_id,a.faculty_id FROM attendance_sessions a WHERE a.id=$1 AND a.status='active' AND a.expires_at>NOW()`,[sessionId]);
    if(!result.rowCount) return NextResponse.json({success:false,message:"Session not found or expired."},{status:404});
    const session=result.rows[0]; if(Number(session.faculty_id)!==user.profileId) return NextResponse.json({success:false,message:"You cannot generate a QR for another faculty member's session."},{status:403});
    const now=Math.floor(Date.now()/1000); const window=Math.floor(now/3)*3;
    const token=await new SignJWT({sessionId:Number(session.id),subjectId:Number(session.subject_id),window}) .setProtectedHeader({alg:"HS256"}).setIssuedAt(now).setExpirationTime(now+10).sign(new TextEncoder().encode(secretValue));
    return NextResponse.json({success:true,token,refreshEverySeconds:3,tokenValidForSeconds:10,expiresAt:now+10});
  } catch(error){console.error(error);return NextResponse.json({success:false,message:"Failed to generate QR token."},{status:500});}
}

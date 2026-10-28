import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ success: false, user: null }, { status: 401 });
  return NextResponse.json({ success: true, user: { role: user.role, fullName: user.fullName, email: user.email, rollNumber: user.rollNumber ?? null, facultyCode: user.facultyCode ?? null, profileId: user.profileId } });
}

import { NextResponse } from "next/server";
import { clearSession, getAuthUser } from "@/lib/auth";
export async function POST() {
  const user = await getAuthUser();
  if (user?.role === "student") return NextResponse.json({ success: false, message: "Student sign-out is disabled for the semester. Contact the administrator for account recovery." }, { status: 403 });
  await clearSession();
  return NextResponse.json({ success: true });
}

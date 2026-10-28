import { NextResponse } from "next/server";
import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
const scrypt = promisify(scryptCallback);
async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role === "faculty" ? "faculty" : body.role === "student" ? "student" : null;
    if (!email || !password || !role) return NextResponse.json({ success: false, message: "Enter your email, password and portal." }, { status: 400 });
    const result = await db.query(`SELECT u.id AS user_id, u.email, u.password_hash, u.role, s.id AS student_id, s.roll_number, s.full_name AS student_name, f.id AS faculty_id, f.faculty_code, f.full_name AS faculty_name FROM app_users u LEFT JOIN students s ON s.id=u.student_id LEFT JOIN faculty f ON f.id=u.faculty_id WHERE LOWER(u.email)=LOWER($1) AND u.role=$2 AND u.is_active=true`, [email, role]);
    if (!result.rowCount || !(await verifyPassword(password, result.rows[0].password_hash))) return NextResponse.json({ success: false, message: "Email/password doesn't match this portal." }, { status: 401 });
    const row = result.rows[0];
    const profileId = role === "student" ? row.student_id : row.faculty_id;
    const fullName = role === "student" ? row.student_name : row.faculty_name;
    if (!profileId || !fullName) return NextResponse.json({ success: false, message: "This account has no linked profile. Contact the administrator." }, { status: 403 });
    await createSession({ userId: row.user_id, role, profileId, email: row.email, fullName, rollNumber: row.roll_number ?? undefined, facultyCode: row.faculty_code ?? undefined });
    return NextResponse.json({ success: true, role, redirectTo: role === "student" ? "/student" : "/faculty", user: { fullName, email, rollNumber: row.roll_number ?? null, facultyCode: row.faculty_code ?? null } });
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ success: false, message: error instanceof Error && error.message.includes("APP_SECRET") ? error.message : "Login service is unavailable. Check database setup and try again." }, { status: 500 });
  }
}

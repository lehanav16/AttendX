import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

export type AppRole = "student" | "faculty";
export type AuthUser = { userId: number; role: AppRole; profileId: number; email: string; fullName: string; rollNumber?: string; facultyCode?: string };
const COOKIE_NAME = "attendx_session";
function secret() {
  const value = process.env.APP_SECRET;
  if (!value || value.length < 32) throw new Error("APP_SECRET must be set to a random value of at least 32 characters.");
  return new TextEncoder().encode(value);
}
export async function createSession(user: AuthUser) {
  const token = await new SignJWT({ role: user.role, profileId: user.profileId, email: user.email, fullName: user.fullName, rollNumber: user.rollNumber, facultyCode: user.facultyCode })
    .setProtectedHeader({ alg: "HS256" }).setSubject(String(user.userId)).setIssuedAt().setExpirationTime("180d").sign(secret());
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
}
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub || (payload.role !== "student" && payload.role !== "faculty") || typeof payload.profileId !== "number" || typeof payload.email !== "string" || typeof payload.fullName !== "string") return null;
    return { userId: Number(payload.sub), role: payload.role, profileId: payload.profileId, email: payload.email, fullName: payload.fullName, rollNumber: typeof payload.rollNumber === "string" ? payload.rollNumber : undefined, facultyCode: typeof payload.facultyCode === "string" ? payload.facultyCode : undefined };
  } catch { return null; }
}
export async function requireRole(role: AppRole) {
  const user = await getAuthUser();
  if (!user || user.role !== role) return null;
  return user;
}
export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

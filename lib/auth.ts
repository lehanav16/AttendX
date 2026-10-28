
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

export type AppRole = "student" | "faculty";

export type AuthUser = {
  userId: number;
  role: AppRole;
  profileId: number;
  email: string;
  fullName: string;
  rollNumber?: string;
  facultyCode?: string;
};

const COOKIE_NAME = "attendx_session";

function getSecret(): Uint8Array {
  const value = process.env.APP_SECRET;

  if (!value || value.length < 32) {
    throw new Error(
      "APP_SECRET must be set to a random value of at least 32 characters."
    );
  }

  return new TextEncoder().encode(value);
}

export async function createSession(user: AuthUser): Promise<void> {
  const token = await new SignJWT({
    role: user.role,
    profileId: String(user.profileId),
    email: user.email,
    fullName: user.fullName,
    rollNumber: user.rollNumber,
    facultyCode: user.facultyCode,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.userId))
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(getSecret());

  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });

    const userId = Number(payload.sub);
    const profileId = Number(payload.profileId);

    if (
      !payload.sub ||
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      (payload.role !== "student" && payload.role !== "faculty") ||
      !Number.isSafeInteger(profileId) ||
      profileId <= 0 ||
      typeof payload.email !== "string" ||
      typeof payload.fullName !== "string"
    ) {
      console.error("[AttendX auth] Session payload is invalid.");
      return null;
    }

    return {
      userId,
      role: payload.role,
      profileId,
      email: payload.email,
      fullName: payload.fullName,
      rollNumber:
        typeof payload.rollNumber === "string"
          ? payload.rollNumber
          : undefined,
      facultyCode:
        typeof payload.facultyCode === "string"
          ? payload.facultyCode
          : undefined,
    };
  } catch (error) {
    console.error(
      "[AttendX auth] Session verification failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return null;
  }
}

export async function requireRole(
  role: AppRole
): Promise<AuthUser | null> {
  const user = await getAuthUser();

  if (!user || user.role !== role) {
    return null;
  }

  return user;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

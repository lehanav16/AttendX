"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "student" | "faculty";

export default function Home() {
  const router = useRouter();

  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("student@attendx.demo");
  const [password, setPassword] = useState("AttendXStudent2026!");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function chooseRole(nextRole: Role) {
    setRole(nextRole);

    if (nextRole === "student") {
      setEmail("student@attendx.demo");
      setPassword("AttendXStudent2026!");
    } else {
      setEmail("faculty@attendx.demo");
      setPassword("AttendXFaculty2026!");
    }

    setMessage("");
  }

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");

    console.log("AttendX: Login form submitted", {
      role,
      email,
    });

    try {
      const controller = new AbortController();

      const timeout = setTimeout(() => {
        controller.abort();
      }, 15000);

      let response: Response;

      try {
        response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({
            role,
            email: email.trim(),
            password,
          }),
        });
      } finally {
        clearTimeout(timeout);
      }

      console.log("AttendX: Login response status:", response.status);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || `Login failed. Status: ${response.status}`
        );
      }

      if (!data.redirectTo) {
        throw new Error("Login succeeded, but no redirect destination was returned.");
      }

      console.log("AttendX: Login successful. Redirecting to:", data.redirectTo);

      router.replace(data.redirectTo);
      router.refresh();
    } catch (error) {
      console.error("AttendX: Login error:", error);

      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage(
          "Login timed out. Check your connection and try again."
        );
      } else if (error instanceof TypeError) {
        setMessage(
          "Could not connect to AttendX. Check your internet connection and try again."
        );
      } else if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-white">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl md:grid-cols-2">
        {/* Left panel */}
        <section className="flex flex-col justify-between bg-gradient-to-br from-indigo-600 via-blue-700 to-slate-900 p-8 md:p-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold">
                A
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  AttendX
                </h1>
                <p className="text-sm text-blue-100">
                  Smart Attendance System
                </p>
              </div>
            </div>

            <div className="mt-12">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">
                Attendance, simplified
              </p>

              <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
                Smarter attendance.
                <br />
                Better accountability.
              </h2>

              <p className="mt-5 max-w-sm leading-7 text-blue-100">
                A convenient attendance experience for students and faculty
                using secure sign-in and QR-based attendance.
              </p>
            </div>
          </div>

          <div className="mt-12 rounded-2xl border border-white/15 bg-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <path
                    d="M12 3 19 6v5c0 4.5-2.9 7.8-7 10-4.1-2.2-7-5.5-7-10V6l7-3Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="m9 12 2 2 4-4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div>
                <p className="font-semibold">One platform, two roles</p>
                <p className="mt-1 text-sm text-blue-100">
                  Dedicated access for students and faculty.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Login panel */}
        <section className="p-6 sm:p-10">
          <div className="mx-auto w-full max-w-md">
            <p className="text-sm font-medium text-indigo-400">
              WELCOME TO ATTENDX
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Sign in to your account
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Choose your account type and enter your login details.
            </p>

            {/* Role selector */}
            <div className="mt-7 grid grid-cols-2 gap-3 rounded-xl bg-slate-800 p-1.5">
              <button
                type="button"
                onClick={() => chooseRole("student")}
                aria-pressed={role === "student"}
                className={`rounded-lg px-3 py-3 text-sm font-semibold transition ${
                  role === "student"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-300 hover:bg-slate-700"
                }`}
              >
                Student
              </button>

              <button
                type="button"
                onClick={() => chooseRole("faculty")}
                aria-pressed={role === "faculty"}
                className={`rounded-lg px-3 py-3 text-sm font-semibold transition ${
                  role === "faculty"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-300 hover:bg-slate-700"
                }`}
              >
                Faculty
              </button>
            </div>

            {/* Login form */}
            <form
              className="mt-7 space-y-5"
              onSubmit={login}
            >
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Email address
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Password
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              {/* Error or diagnostic message */}
              {message && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300"
                >
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <svg
                      className="h-5 w-5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeWidth="3"
                        opacity="0.25"
                      />
                      <path
                        d="M21 12a9 9 0 0 0-9-9"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                    Signing in…
                  </>
                ) : (
                  `Continue as ${role} →`
                )}
              </button>
            </form>
            
<div className="mt-3 text-center">
  <button
    type="button"
    onClick={() => alert("Password reset is currently unavailable.")}
    className="text-sm font-medium text-indigo-400 transition hover:text-indigo-300 hover:underline"
  >
    Forgot Password?
  </button>
</div>

            <p className="mt-6 text-center text-xs text-slate-500">
              AttendX · Smart Attendance Management
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
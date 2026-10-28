
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

type Subject = {
  id: number;
  subject_code: string;
  subject_name: string;
  semester: number;
  enrolled_count: number;
};

type Session = {
  id: number;
  subject_id: number;
  expires_at: string;
  started_at: string;
  subject_name: string;
  subject_code: string;
};

type Attendance = {
  roll_number: string;
  full_name: string;
  marked_at: string;
};

type RegisterSession = {
  id: number;
  started_at: string;
  status: string;
};

type RegisterAttendance = {
  sessionId: number;
  status: "Present" | "Absent";
  markedAt: string | null;
};

type RegisterStudent = {
  roll_number: string;
  full_name: string;
  attendance: RegisterAttendance[];
  presentCount: number;
  totalSessions: number;
  percentage: number;
};

type RegisterData = {
  subject: { id: number; subject_code: string; subject_name: string };
  sessions: RegisterSession[];
  students: RegisterStudent[];
};

export default function FacultyPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [records, setRecords] = useState<Attendance[]>([]);
  const [register, setRegister] = useState<RegisterData | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [message, setMessage] = useState(
    "Choose a subject and start an attendance session."
  );
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [userName, setUserName] = useState("");

  const busy = useRef(false);
  const router = useRouter();

  // Check login and load faculty subjects.
  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/auth/me");

        if (!me.ok) {
          router.replace("/");
          return;
        }

        const md = await me.json();

        if (md.user.role !== "faculty") {
          router.replace("/student");
          return;
        }

        setUserName(md.user.fullName);

        const response = await fetch("/api/faculty");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Could not load subjects.");
        }

        setSubjects(data.subjects || []);

        if (data.subjects?.length) {
          setSubjectId(String(data.subjects[0].id));
        }
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load faculty dashboard."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // Load the date-by-date register for the selected subject.
  const loadRegister = useCallback(async (selectedSubjectId: string) => {
    if (!selectedSubjectId) {
      setRegister(null);
      return;
    }

    setRegisterLoading(true);
    setRegisterError("");

    try {
      const response = await fetch(
        `/api/faculty/register?subjectId=${encodeURIComponent(selectedSubjectId)}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load subject register.");
      }

      setRegister(data);
    } catch (error) {
      setRegisterError(
        error instanceof Error ? error.message : "Could not load subject register."
      );
    } finally {
      setRegisterLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subjectId) void loadRegister(subjectId);
  }, [subjectId, loadRegister]);

  function exportRegisterCsv() {
    if (!register) return;

    const escapeCsv = (value: string | number) => {
      const text = String(value);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const headers = [
      "Roll number",
      "Student name",
      ...register.sessions.map((item) =>
        new Date(item.started_at).toLocaleString()
      ),
      "Present count",
      "Total classes",
      "Attendance percentage",
    ];
    const rows = register.students.map((student) => [
      student.roll_number,
      student.full_name,
      ...student.attendance.map((item) => item.status),
      student.presentCount,
      student.totalSessions,
      `${student.percentage}%`,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${register.subject.subject_code}-attendance-register.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // Refresh the attendance list for the selected session.
  const refreshRecords = useCallback(async (id: number) => {
    try {
      const response = await fetch(
        `/api/attendance/session?sessionId=${id}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (response.ok) {
        setRecords(data.attendance || []);

        if (data.session?.status !== "active") {
          setMessage("This attendance session is closed.");
        }
      }
    } catch {
      // Keep the existing list if a refresh temporarily fails.
    }
  }, []);

  async function startAttendance() {
    if (!subjectId) return;

    setStarting(true);
    setMessage("Starting attendance session…");
    setQrImage("");
    setRecords([]);

    try {
      const response = await fetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId: Number(subjectId) }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not start session.");
      }

      setSession(data.session);

      setRemaining(
        Math.max(
          0,
          Math.floor(
            (new Date(data.session.expires_at).getTime() - Date.now()) /
              1000
          )
        )
      );

      setMessage("Session started. Preparing dynamic QR…");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not start session."
      );
    } finally {
      setStarting(false);
    }
  }

  // Rotate the QR code and refresh live attendance.
  useEffect(() => {
    if (!session) return;

    const activeSession = session;
    let stopped = false;

    async function refreshQR() {
      if (busy.current || stopped) return;

      if (
        new Date(activeSession.expires_at).getTime() <= Date.now()
      ) {
        setMessage("Session expired. Start a new session.");
        setQrImage("");
        setSession(null);
        void loadRegister(String(activeSession.subject_id));
        return;
      }

      busy.current = true;

      try {
        const response = await fetch("/api/sessions/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: activeSession.id }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Could not refresh QR.");
        }

        const image = await QRCode.toDataURL(data.token, {
          width: 300,
          margin: 2,
          errorCorrectionLevel: "H",
        });

        if (!stopped) {
          setQrImage(image);
          setMessage(
            "QR rotates every 3 seconds. Ask students to scan it now."
          );
        }
      } catch (error) {
        if (!stopped) {
          setMessage(
            error instanceof Error
              ? error.message
              : "QR refresh failed."
          );
        }
      } finally {
        busy.current = false;
      }
    }

    const qrTimer = setInterval(() => {
      void refreshQR();
    }, 3000);

    void refreshQR();

    const attendanceTimer = setInterval(() => {
      void refreshRecords(activeSession.id);
      void loadRegister(String(activeSession.subject_id));
    }, 5000);

    return () => {
      stopped = true;
      clearInterval(qrTimer);
      clearInterval(attendanceTimer);
      busy.current = false;
    };
  }, [session, refreshRecords, loadRegister]);

  // Update the session countdown.
  useEffect(() => {
    if (!session) return;

    const timer = setInterval(() => {
      const seconds = Math.max(
        0,
        Math.floor(
          (new Date(session.expires_at).getTime() - Date.now()) / 1000
        )
      );

      setRemaining(seconds);

      if (seconds <= 0) {
        setQrImage("");
        setSession(null);
        setMessage("Session expired. Start a new session.");
        void loadRegister(String(session.subject_id));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [session, loadRegister]);

  async function closeSession() {
    if (!session) return;

    try {
      const response = await fetch("/api/sessions/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not close session.");
      }

      setSession(null);
      setQrImage("");
      setRecords([]);
      setMessage("Attendance session closed.");
      await loadRegister(String(session.subject_id));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not close session."
      );
    }
  }

  async function signOut() {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
    });

    if (response.ok) {
      router.replace("/");
    }
  }

  return (
    <main className="min-h-screen bg-[#07111f] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <nav className="flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <div className="text-2xl font-black">
              Attend<span className="text-cyan-300">X</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Faculty workspace
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-300 sm:inline">
              {userName}
            </span>
            <button
              onClick={() => void signOut()}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
            >
              Sign out
            </button>
          </div>
        </nav>

        <section className="mt-8">
          <p className="text-sm font-semibold tracking-widest text-cyan-300">
            FACULTY PORTAL
          </p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Attendance control room
          </h1>
          <p className="mt-2 text-slate-400">
            Start a class session, project the rotating QR code and monitor
            attendance as students check in.
          </p>
        </section>

        {loading ? (
          <p className="mt-8 text-slate-400">Loading your subjects…</p>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
            <section className="rounded-2xl border border-white/10 bg-[#101d2d] p-5 md:p-6">
              <h2 className="text-xl font-bold">Start a class</h2>

              <label
                htmlFor="subject"
                className="mt-5 block text-sm text-slate-300"
              >
                Subject
              </label>

              <select
                id="subject"
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                disabled={!!session}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#07111f] px-4 py-3 text-white outline-none focus:border-cyan-300"
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.subject_code} · {subject.subject_name}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-slate-400">
                {subjects.find((subject) => String(subject.id) === subjectId)
                  ?.enrolled_count ?? 0}{" "}
                enrolled students
              </p>

              <button
                onClick={() => void startAttendance()}
                disabled={starting || !!session || !subjectId}
                className="mt-5 w-full rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-50"
              >
                {starting
                  ? "Starting…"
                  : session
                    ? "Session in progress"
                    : "Start attendance session"}
              </button>

              {session && (
                <div className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4">
                  <p className="text-sm text-slate-400">ACTIVE SESSION</p>
                  <p className="mt-1 text-lg font-bold">
                    {session.subject_name} · {session.subject_code}
                  </p>
                  <p className="mt-3 text-sm text-slate-400">
                    Time remaining
                  </p>
                  <p className="text-3xl font-bold tabular-nums">
                    {Math.floor(remaining / 60)}:
                    {String(remaining % 60).padStart(2, "0")}
                  </p>
                  <button
                    onClick={() => void closeSession()}
                    className="mt-4 rounded-lg border border-white/15 px-3 py-2 text-sm"
                  >
                    Close attendance session
                  </button>
                </div>
              )}

              <p className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-slate-300">
                {message}
              </p>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Session length: 60 minutes. QR refresh: every 3 seconds. The
                server rejects expired sessions and duplicate attendance.
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#101d2d] p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold">Live QR & attendance</h2>
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                  {session ? "Live" : "Not started"}
                </span>
              </div>

              <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,300px)_1fr] md:items-start">
                <div className="flex min-h-72 items-center justify-center rounded-2xl bg-white p-3">
                  {qrImage ? (
                    <img
                      src={qrImage}
                      alt="Dynamic attendance QR code"
                      className="h-auto w-full max-w-[280px]"
                    />
                  ) : (
                    <p className="px-5 text-center text-sm text-slate-500">
                      Start a session to generate the dynamic QR code.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Students marked</h3>
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-sm">
                      {records.length}
                    </span>
                  </div>

                  <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto">
                    {records.map((record) => (
                      <div
                        key={`${record.roll_number}-${record.marked_at}`}
                        className="rounded-xl border border-white/10 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">
                              {record.full_name}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {record.roll_number}
                            </p>
                          </div>
                          <span className="text-xs text-emerald-300">
                            Present
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
                          {new Date(record.marked_at).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}

                    {!records.length && (
                      <p className="rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-slate-500">
                        No attendance recorded yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Subject-wise spreadsheet register */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-[#101d2d] p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Subject attendance register</h2>
              <p className="mt-1 text-sm text-slate-400">
                Each column is a completed class session. Only enrolled students are listed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void loadRegister(subjectId)}
                disabled={!subjectId || registerLoading}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
              >
                {registerLoading ? "Refreshing…" : "Refresh register"}
              </button>
              <button
                onClick={exportRegisterCsv}
                disabled={!register || register.students.length === 0}
                className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                Export CSV
              </button>
            </div>
          </div>

          {registerError && (
            <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-300">
              {registerError}
            </p>
          )}

          {registerLoading && !register ? (
            <p className="mt-5 text-sm text-slate-400">Loading subject register…</p>
          ) : register ? (
            <>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 p-4">
                <div>
                  <p className="font-semibold">{register.subject.subject_code} · {register.subject.subject_name}</p>
                  <p className="mt-1 text-xs text-slate-400">{register.students.length} enrolled students · {register.sessions.length} completed classes</p>
                </div>
                <p className="text-xs text-slate-400">Attendance is calculated from closed sessions.</p>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-white/5">
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                      <th className="sticky left-0 z-10 bg-[#142235] px-3 py-3 font-medium">Roll number</th>
                      <th className="sticky left-[112px] z-10 bg-[#142235] px-3 py-3 font-medium">Student</th>
                      {register.sessions.map((item) => (
                        <th key={item.id} className="min-w-[115px] px-3 py-3 font-medium">
                          {new Date(item.started_at).toLocaleDateString()}
                          <span className="mt-1 block normal-case tracking-normal text-slate-500">
                            {new Date(item.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </th>
                      ))}
                      <th className="px-3 py-3 font-medium">Present</th>
                      <th className="px-3 py-3 font-medium">Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {register.students.map((student) => (
                      <tr key={student.roll_number} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                        <td className="sticky left-0 bg-[#101d2d] px-3 py-3 font-medium">{student.roll_number}</td>
                        <td className="sticky left-[112px] bg-[#101d2d] px-3 py-3">{student.full_name}</td>
                        {student.attendance.map((item) => (
                          <td key={item.sessionId} className="px-3 py-3">
                            <span className={item.status === "Present" ? "rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300" : "rounded-full bg-rose-400/10 px-2.5 py-1 text-xs text-rose-300"}>
                              {item.status}
                            </span>
                          </td>
                        ))}
                        <td className="px-3 py-3 tabular-nums">{student.presentCount}/{student.totalSessions}</td>
                        <td className="px-3 py-3">
                          <span className={student.percentage >= 75 ? "font-semibold text-emerald-300" : "font-semibold text-amber-300"}>{student.percentage}%</span>
                        </td>
                      </tr>
                    ))}
                    {!register.students.length && (
                      <tr><td colSpan={register.sessions.length + 4} className="px-3 py-10 text-center text-slate-400">No students are enrolled in this subject yet.</td></tr>
                    )}
                    {register.students.length > 0 && register.sessions.length === 0 && (
                      <tr><td colSpan={4} className="px-3 py-5 text-center text-slate-400">No completed classes yet. Close a session to add its date to the register.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                A class appears after the session is closed or its time expires. Active classes are excluded so students are not marked absent while attendance is still open.
              </p>
            </>
          ) : (
            <p className="mt-5 text-sm text-slate-400">Choose a subject to view its attendance register.</p>
          )}
        </section>
      </div>
    </main>
  );
}

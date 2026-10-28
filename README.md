# AttendX — Student & Faculty Attendance Web App

Next.js + TypeScript + PostgreSQL demo app with role-based demo login, student dashboards, mobile QR scanning, dynamic faculty QR generation, attendance timestamps, duplicate prevention and faculty attendance lists.

## Demo credentials

| Portal | Email | Password |
|---|---|---|
| Student | `student@attendx.demo` | `AttendXStudent2026!` |
| Faculty | `faculty@attendx.demo` | `AttendXFaculty2026!` |
| Student 2 | `diya@attendx.demo` | `Student2Demo2026!` |
| Student 3 | `kabir@attendx.demo` | `Student3Demo2026!` |
| Student 4 | `meera@attendx.demo` | `Student4Demo2026!` |
| Student 5 | `rohan@attendx.demo` | `Student5Demo2026!` |

Demo identities and attendance are fictional. Change these credentials and use institution-approved identity data before any real deployment.

## Setup (Windows / Git Bash)

1. Install Node.js 20+ and PostgreSQL 15+.
2. Create a PostgreSQL database, for example `attendx_db`.
3. In this project folder, copy `.env.example` to `.env.local` and set `DATABASE_URL`. Generate two independent secrets:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Use one output for `APP_SECRET`, and another for `QR_SECRET`. Never commit `.env.local`.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Create tables and demo data:
   ```bash
   psql -U postgres -d attendx_db -f db/schema.sql
   npm run db:seed
   ```
   If `psql` is not on PATH, run the SQL file in pgAdmin's Query Tool against `attendx_db`.
6. Start the development server:
   ```bash
   npm run dev
   ```
7. Open `http://localhost:3000`. Use the demo credentials above.

For a phone camera to work against a computer-hosted server, the site must be reachable from the phone and served over HTTPS (localhost is a browser exception). The QR and scan device must be on a reachable network. Do not expose a development server publicly.

## What the project implements

- Role-selecting login page backed by PostgreSQL demo accounts; password hashes use Node's scrypt, and successful logins receive an HTTP-only signed cookie.
- Server-side role checks for student/faculty APIs; student attendance is bound to the authenticated account rather than a roll number typed into the phone.
- Student dashboard lists enrolled subjects, active sessions and server-timestamped attendance history.
- Mobile QR scanner using `html5-qrcode`, followed by a live front-camera image capture step.
- Faculty dashboard lists authorized subjects, starts a 60-minute class session, rotates signed QR tokens every three seconds, and refreshes the class attendance list.
- QR token signature/expiry/session checks, enrollment checks and a database uniqueness constraint on `(session_id, student_id)` prevent duplicate marks for the same class session.
- Student logout is intentionally disabled in the UI and API; faculty can sign out.
- Server-side `NOW()` timestamps are stored in PostgreSQL.

## Important face-verification limitation

The current build captures a live camera image as an attendance gate, but **does not perform biometric face matching against a previously enrolled face, nor reliable liveness/anti-spoof detection**. The server records that a camera capture was submitted; it must not be treated as proof that the account owner was present. A real deployment needs an explicit face-enrolment/consent flow, a maintained face-verification provider/model, server-side descriptor comparison, liveness controls, privacy/retention policy, and security testing. Do not use this demo to make consequential attendance decisions until that integration is completed and validated.

## Semester-long sign-in limitation

Student cookies are HTTP-only and last up to 180 days, and students have no normal logout action. Browser storage clearing, browser policies, device loss, cookie expiry or administrator action can still end a session. A secure institution-managed recovery process is needed; never promise an unbreakable semester-long browser session.

## Security and deployment notes

- Do not reuse real student passwords or publish the demo accounts on a public deployment.
- Use HTTPS, strong independent secrets, database backups, rate limiting, audit logs, CSRF/origin protections and security review before production.
- This project does not store the captured selfie. It is sent to the attendance API only to check that a capture was submitted and is discarded after the request; it is not biometric identity verification.
- If your hosted database requires TLS, set `DATABASE_SSL=true`.

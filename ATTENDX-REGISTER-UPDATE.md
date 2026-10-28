# AttendX subject-wise attendance register update

This update adds a subject-specific attendance register to the existing faculty dashboard.

## Included
- New faculty-only API: `/api/faculty/register?subjectId=<id>`.
- Register lists enrolled students as rows and completed class sessions as columns.
- Each student/session cell is Present or Absent.
- Per-student present count and attendance percentage.
- CSV export suitable for Excel or Google Sheets.
- Expired sessions are marked closed when the register is requested, so a session that ran out of time can be counted.
- Existing login, QR-session endpoints, and live attendance list are retained.

## Attendance rules
- A session is included when it is closed or has expired.
- Active sessions are excluded, so students are not counted absent while scanning is still open.
- Closing a session early still makes it a completed class for the register.
- The percentage is calculated from included completed sessions; with no completed sessions it is 0%.

## Run locally
1. Keep your own `.env.local` in the project folder; it is intentionally not included in this ZIP.
2. Install dependencies with `npm install` if needed.
3. Start the development server with `npm run dev`.
4. Sign in as faculty, select a subject, and scroll to **Subject attendance register**.

## Verification and limitation
- TypeScript check (`tsc --noEmit`) passed in the prepared project.
- A production build could not be completed in the packaging environment because Next.js attempted to download its Linux SWC binary and network access was unavailable.
- The existing student camera flow is preserved, but it still captures a selfie only. This update does not claim to provide actual facial-landmark liveness detection or biometric identity matching.

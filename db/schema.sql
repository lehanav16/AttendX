BEGIN;
CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY, roll_number TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE, department TEXT NOT NULL DEFAULT 'CSE', semester INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS faculty (
  id BIGSERIAL PRIMARY KEY, faculty_code TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE, department TEXT NOT NULL DEFAULT 'CSE', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS subjects (
  id BIGSERIAL PRIMARY KEY, subject_code TEXT NOT NULL UNIQUE, subject_name TEXT NOT NULL,
  semester INTEGER NOT NULL DEFAULT 3, faculty_id BIGINT NOT NULL REFERENCES faculty(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS enrollments (
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (student_id, subject_id)
);
CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','faculty')),
  student_id BIGINT UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  faculty_id BIGINT UNIQUE REFERENCES faculty(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((role='student' AND student_id IS NOT NULL AND faculty_id IS NULL) OR (role='faculty' AND faculty_id IS NOT NULL AND student_id IS NULL))
);
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id BIGSERIAL PRIMARY KEY, subject_id BIGINT NOT NULL REFERENCES subjects(id),
  faculty_id BIGINT NOT NULL REFERENCES faculty(id), started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, status TEXT NOT NULL CHECK (status IN ('active','closed')) DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS attendance_sessions_subject_status_idx ON attendance_sessions(subject_id,status,expires_at);
CREATE TABLE IF NOT EXISTS attendance_records (
  id BIGSERIAL PRIMARY KEY, session_id BIGINT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id), marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present')),
  face_check TEXT NOT NULL DEFAULT 'camera-capture', UNIQUE(session_id,student_id)
);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS face_check TEXT NOT NULL DEFAULT 'camera-capture';
CREATE UNIQUE INDEX IF NOT EXISTS attendance_one_mark_per_session_idx ON attendance_records(session_id,student_id);
COMMIT;

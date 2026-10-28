import { scrypt as scryptCallback, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';
const { Pool } = pg;
const scrypt = promisify(scryptCallback);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
async function passwordHash(password) { const salt = randomBytes(16).toString('hex'); const hash = await scrypt(password, salt, 64); return `${salt}:${Buffer.from(hash).toString('hex')}`; }
async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const students = [
      ['CS25001','Aarav Sharma','student@attendx.demo'],
      ['CS25002','Diya Reddy','diya@attendx.demo'],
      ['CS25003','Kabir Shah','kabir@attendx.demo'],
      ['CS25004','Meera Nair','meera@attendx.demo'],
      ['CS25005','Rohan Das','rohan@attendx.demo'],
    ];
    for (const [roll,name,email] of students) await client.query(`INSERT INTO students(roll_number,full_name,email,department,semester) VALUES($1,$2,$3,'CSE',3) ON CONFLICT(roll_number) DO UPDATE SET full_name=EXCLUDED.full_name,email=EXCLUDED.email`,[roll,name,email]);
    await client.query(`INSERT INTO faculty(faculty_code,full_name,email,department) VALUES('FAC001','Dr. Ananya Rao','faculty@attendx.demo','CSE') ON CONFLICT(faculty_code) DO UPDATE SET full_name=EXCLUDED.full_name,email=EXCLUDED.email`);
    const fac = (await client.query(`SELECT id FROM faculty WHERE faculty_code='FAC001'`)).rows[0].id;
    const subjects = [['CS301','Operating Systems'],['CS302','Computer Networks'],['CS303','Design and Analysis of Algorithms'],['CS304','Software Development Tools and Technologies']];
    for (const [code,name] of subjects) await client.query(`INSERT INTO subjects(subject_code,subject_name,semester,faculty_id) VALUES($1,$2,3,$3) ON CONFLICT(subject_code) DO UPDATE SET subject_name=EXCLUDED.subject_name,faculty_id=EXCLUDED.faculty_id`,[code,name,fac]);
    const subjectRows = (await client.query(`SELECT id FROM subjects WHERE subject_code = ANY($1::text[])`,[subjects.map(x=>x[0])])).rows;
    const studentRows = (await client.query(`SELECT id FROM students WHERE roll_number = ANY($1::text[])`,[students.map(x=>x[0])])).rows;
    for (const s of studentRows) for (const sub of subjectRows) await client.query(`INSERT INTO enrollments(student_id,subject_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[s.id,sub.id]);
    const accounts = [
      {email:'student@attendx.demo',role:'student',studentRoll:'CS25001',password:'AttendXStudent2026!'},
      {email:'faculty@attendx.demo',role:'faculty',facultyCode:'FAC001',password:'AttendXFaculty2026!'},
      ...students.slice(1).map(([roll,,email],i)=>({email,role:'student',studentRoll:roll,password:`Student${i+2}Demo2026!`})),
    ];
    for (const a of accounts) {
      const hash = await passwordHash(a.password);
      if (a.role==='student') {
        const sid=(await client.query('SELECT id FROM students WHERE roll_number=$1',[a.studentRoll])).rows[0].id;
        await client.query(`INSERT INTO app_users(email,password_hash,role,student_id) VALUES($1,$2,'student',$3) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,student_id=EXCLUDED.student_id,is_active=true`,[a.email,hash,sid]);
      } else await client.query(`INSERT INTO app_users(email,password_hash,role,faculty_id) VALUES($1,$2,'faculty',$3) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,faculty_id=EXCLUDED.faculty_id,is_active=true`,[a.email,hash,fac]);
    }
    await client.query('COMMIT');
    console.log('Demo data seeded.');
    console.log('Student: student@attendx.demo / AttendXStudent2026!');
    console.log('Faculty: faculty@attendx.demo / AttendXFaculty2026!');
    console.log('Other student accounts: see README.md');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); await pool.end(); }
}
main().catch(e=>{console.error(e);process.exit(1)});

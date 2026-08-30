'use strict';

/**
 * API 冒烟测试：独立临时 SQLite，不污染开发库。
 * 运行（在 app 目录）：npm run test:api
 */
const { test, before, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const request = require('supertest');

const dbFile = path.join(os.tmpdir(), `alevel-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);

function rmDbFiles(f) {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(f + suffix);
    } catch {
      // ignore
    }
  }
}

describe('API smoke', () => {
  /** @type {import('express').Application} */
  let app;

  before(async () => {
    rmDbFiles(dbFile);
    process.env.SQLITE_PATH = dbFile;
    process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters-long!!';
    process.env.NODE_ENV = 'test';
    process.env.METRICS_TOKEN = 'test-metrics-secret';
    delete process.env.SENTRY_DSN;

    const dbPath = require.resolve('../db.js');
    const indexPath = require.resolve('../index.js');
    delete require.cache[dbPath];
    delete require.cache[indexPath];

    const { initDb } = require('../db.js');
    await initDb();
    ({ app } = require('../index.js'));
  });

  test('GET /api/health', async () => {
    const res = await request(app).get('/api/health').expect(200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.db, true);
    assert.ok(res.headers['x-request-id']);
  });

  test('GET /api/metrics with wrong token', async () => {
    const res = await request(app).get('/api/metrics').set('X-Metrics-Token', 'wrong').expect(401);
    assert.ok(res.body.error);
  });

  test('GET /api/metrics with token', async () => {
    const res = await request(app)
      .get('/api/metrics')
      .set('X-Metrics-Token', 'test-metrics-secret')
      .expect(200);
    assert.ok(typeof res.body.requests_total === 'number');
    assert.ok(res.body.by_route);
  });

  test('POST /api/auth/login (seed admin)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.role, 'admin');
  });

  test('GET course detail derives visible summaries from unit grades without mutating legacy fields', async () => {
    const { getDb } = require('../db.js');
    const db = getDb();
    const courseId = 'test-course-unit-summary';
    const studentId = 'test-student-unit-summary';
    const studentCourseId = 'test-enrollment-unit-summary';

    db.prepare(
      `INSERT INTO courses (id, name, subject_code, board, grade_level, max_students)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(courseId, 'Unit Summary Test', 'UST', 'Edexcel', 'ALL', 20);
    db.prepare(
      `INSERT INTO students (id, name, grade, status)
       VALUES (?, ?, ?, ?)`
    ).run(studentId, 'Unit Summary Student', '2025级', 'active');
    db.prepare(
      `INSERT INTO student_courses
       (id, student_id, course_id, internal_grade, internal_score, mock_grade, mock_score, final_grade, final_score, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(studentCourseId, studentId, courseId, '', null, '', null, '', null, 'enrolled');

    const insertUnit = db.prepare(
      `INSERT INTO unit_grades
       (id, student_course_id, unit_name, unit_code, score, max_score, grade, exam_date, exam_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertUnit.run('test-unit-internal-1', studentCourseId, 'Internal 1', 'INT-1', 80, 100, '', '2025-01-10', 'internal');
    insertUnit.run('test-unit-internal-2', studentCourseId, 'Internal 2', 'INT-2', 90, 100, '', '2025-02-10', 'internal');
    insertUnit.run('test-unit-mock-1', studentCourseId, 'Mock 1', 'M1', 70, 100, '', '2025-03-10', 'mock');
    insertUnit.run('test-unit-final-1', studentCourseId, 'Final U1', 'U1', 50, 100, 'D', '2025-05-10', 'final');
    insertUnit.run('test-unit-retake-1', studentCourseId, 'Retake U1', 'U1', 70, 100, 'B', '2025-06-10', 'retake');
    insertUnit.run('test-unit-final-2', studentCourseId, 'Final U2', 'U2', 80, 100, 'A', '2025-05-10', 'final');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    const res = await request(app)
      .get(`/api/courses/${courseId}/detail`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);

    const student = res.body.students[0];
    assert.strictEqual(student.internal_score, null);
    assert.deepStrictEqual(student.score_summary.internal, { score: 85, grade: null, count: 2 });
    assert.deepStrictEqual(student.score_summary.mock, { score: 70, grade: null, count: 1 });
    assert.strictEqual(student.score_summary.final.score, 75);
    assert.strictEqual(student.score_summary.final.grade, null);
    assert.strictEqual(student.score_summary.final.count, 2);
    assert.deepStrictEqual(student.score_summary.final.units, [
      { unit_code: 'U1', unit_name: 'Retake U1', score: 70, max_score: 100, percentage: 70, exam_type: 'retake', exam_date: '2025-06-10' },
      { unit_code: 'U2', unit_name: 'Final U2', score: 80, max_score: 100, percentage: 80, exam_type: 'final', exam_date: '2025-05-10' },
    ]);
    assert.strictEqual(res.body.stats.avg_internal, 85);
    assert.strictEqual(res.body.stats.avg_mock, 70);
    assert.strictEqual(res.body.stats.avg_final, 75);
    assert.strictEqual(res.body.stats.max_final, 75);
    assert.strictEqual(res.body.stats.min_final, 75);
    assert.strictEqual(res.body.stats.students_with_final, 1);
  });

  test('GET grade overview keeps IELTS scope and includes zero scores', async () => {
    const { getDb } = require('../db.js');
    const db = getDb();
    const courseId = 'test-course-grade-overview';
    const studentOneId = 'test-student-grade-overview-1';
    const studentTwoId = 'test-student-grade-overview-2';

    db.prepare(
      `INSERT INTO courses (id, name, subject_code, board, grade_level, max_students)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(courseId, 'Grade Overview Test', 'GOT', 'Cambridge', 'ALL', 20);

    const insertStudent = db.prepare(
      `INSERT INTO students (id, name, grade, status)
       VALUES (?, ?, ?, ?)`
    );
    insertStudent.run(studentOneId, 'Grade Overview Student One', '2025级', 'active');
    insertStudent.run(studentTwoId, 'Grade Overview Student Two', '2025级', 'active');

    const insertEnrollment = db.prepare(
      `INSERT INTO student_courses
       (id, student_id, course_id, internal_score, mock_score, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    insertEnrollment.run('test-enrollment-grade-overview-1', studentOneId, courseId, 0, 0, 'enrolled');
    insertEnrollment.run('test-enrollment-grade-overview-2', studentTwoId, courseId, 80, null, 'enrolled');

    const insertCourseUnit = db.prepare(
      `INSERT INTO course_units
       (id, course_id, unit_code, unit_name, max_score, weight, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insertCourseUnit.run('test-course-unit-grade-overview-1', courseId, 'U1', 'Unit 1', 100, 1, 1);
    insertCourseUnit.run('test-course-unit-grade-overview-2', courseId, 'U2', 'Unit 2', 100, 1, 2);

    const insertUnitGrade = db.prepare(
      `INSERT INTO unit_grades
       (id, student_course_id, unit_name, unit_code, score, max_score, exam_date, exam_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertUnitGrade.run('test-grade-overview-s1-u1-final', 'test-enrollment-grade-overview-1', 'Unit 1', 'U1', 60, 100, '2025-05-01', 'final');
    insertUnitGrade.run('test-grade-overview-s1-u1-retake', 'test-enrollment-grade-overview-1', 'Unit 1', 'U1', 80, 100, '2025-06-01', 'retake');
    insertUnitGrade.run('test-grade-overview-s1-u2', 'test-enrollment-grade-overview-1', 'Unit 2', 'U2', 40, 100, '2025-05-01', 'final');
    insertUnitGrade.run('test-grade-overview-s2-u1', 'test-enrollment-grade-overview-2', 'Unit 1', 'U1', 100, 100, '2025-05-01', 'final');
    insertUnitGrade.run('test-grade-overview-s2-u2', 'test-enrollment-grade-overview-2', 'Unit 2', 'U2', 60, 100, '2025-05-01', 'final');

    const insertLanguageScore = db.prepare(
      `INSERT INTO language_scores
       (id, student_id, test_type, overall_score, test_date, is_best_score)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    insertLanguageScore.run('test-language-grade-overview-ielts-0', studentOneId, 'IELTS', 0, '2025-01-01', 1);
    insertLanguageScore.run('test-language-grade-overview-toefl', studentOneId, 'TOEFL', 120, '2025-01-02', 1);
    insertLanguageScore.run('test-language-grade-overview-ielts-65', studentTwoId, 'IELTS', 6.5, '2025-01-03', 1);
    insertLanguageScore.run('test-language-grade-overview-pte', studentTwoId, 'PTE', 80, '2025-01-04', 1);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    const res = await request(app)
      .get(`/api/students/grade-overview/${encodeURIComponent('2025级')}`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);

    const course = res.body.courseStats.find((item) => item.name === 'Grade Overview Test');
    assert.ok(course);
    assert.strictEqual(course.student_count, 2);
    assert.strictEqual(course.actual_exam_avg, 70);
    assert.strictEqual(course.actual_exam_student_count, 2);
    assert.strictEqual(course.actual_exam_unit_count, 4);
    assert.strictEqual(res.body.languageStats.has_ielts, 2);
    assert.strictEqual(res.body.languageStats.avg_ielts, 3.25);
    assert.strictEqual(res.body.languageStats.max_ielts, 6.5);
  });

  test('GET A-Level predictions uses retake scores and freezes completed grades', async () => {
    const { getDb } = require('../db.js');
    const { predictCourseFromUnits } = require('../services/alevel-prediction');
    const db = getDb();
    const courseId = 'test-course-alevel-prediction';
    const studentId = 'test-student-alevel-prediction';
    const enrollmentId = 'test-enrollment-alevel-prediction';

    db.prepare(
      `INSERT INTO courses (id, name, subject_code, board, grade_level, max_students)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(courseId, 'A-Level Prediction Test', 'APT', 'Edexcel', 'ALL', 20);
    db.prepare(
      `INSERT INTO students (id, name, grade, status)
       VALUES (?, ?, ?, ?)`
    ).run(studentId, 'A-Level Prediction Student', '2025级', 'active');
    db.prepare(
      `INSERT INTO student_courses
       (id, student_id, course_id, internal_score, mock_score, final_score, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(enrollmentId, studentId, courseId, null, null, null, 'enrolled');

    const insertUnit = db.prepare(
      `INSERT INTO course_units
       (id, course_id, unit_code, unit_name, is_advanced, max_score, weight, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertUnit.run('test-course-unit-apt-1', courseId, 'U1', 'Unit 1', 0, 100, 1, 1);
    insertUnit.run('test-course-unit-apt-2', courseId, 'U2', 'Unit 2', 1, 100, 1, 2);
    insertUnit.run('test-course-unit-apt-optional', courseId, 'D1', 'Optional Unit', 0, 100, 1, 3);
    db.prepare('UPDATE course_units SET is_required = 0 WHERE id = ?').run('test-course-unit-apt-optional');

    const insertGrade = db.prepare(
      `INSERT INTO unit_grades
       (id, student_course_id, unit_name, unit_code, score, max_score, grade, exam_date, exam_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertGrade.run('test-unit-apt-u1', enrollmentId, 'Unit 1', 'U1', 80, 100, 'A', '2026-01-10', 'final');
    insertGrade.run('test-unit-apt-u2-final', enrollmentId, 'Unit 2', 'U2', 60, 100, 'C', '2026-01-10', 'final');
    insertGrade.run('test-unit-apt-u2-retake', enrollmentId, 'Unit 2', 'U2', 80, 100, 'A', '2026-06-10', 'retake');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    const first = await request(app)
      .get(`/api/students/${studentId}/alevel-predictions`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
    const second = await request(app)
      .get(`/api/students/${studentId}/alevel-predictions`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);

    const prediction = first.body.predictions[0];
    const repeatedPrediction = second.body.predictions[0];
    assert.strictEqual(prediction.predicted_grade, 'A');
    assert.strictEqual(prediction.predicted_pct, 80);
    assert.strictEqual(prediction.observed_units, 2);
    assert.strictEqual(prediction.total_units, 2);
    assert.strictEqual(prediction.predicted_advanced_pct, 80);
    assert.strictEqual(prediction.is_finalized, true);
    assert.strictEqual(prediction.prediction_basis, 'confirmed');
    assert.strictEqual(prediction.confidence, 1);
    assert.deepStrictEqual(prediction.probabilities, { 'A*': 0, A: 1, B: 0, C: 0, D: 0, E: 0, U: 0 });
    assert.deepStrictEqual(
      {
        predicted_grade: repeatedPrediction.predicted_grade,
        predicted_pct: repeatedPrediction.predicted_pct,
        predicted_advanced_pct: repeatedPrediction.predicted_advanced_pct,
        probabilities: repeatedPrediction.probabilities,
      },
      {
        predicted_grade: prediction.predicted_grade,
        predicted_pct: prediction.predicted_pct,
        predicted_advanced_pct: prediction.predicted_advanced_pct,
        probabilities: prediction.probabilities,
      }
    );

    const aStar = predictCourseFromUnits({
      units: [
        { unit_code: 'U1', max_score: 100, weight: 1, is_advanced: false, exam_pct: 0.8 },
        { unit_code: 'U2', max_score: 100, weight: 1, is_advanced: true, exam_pct: 0.9 },
      ],
    });
    assert.strictEqual(aStar.predicted_grade, 'A*');
    assert.strictEqual(aStar.is_finalized, true);

    const manuallyConfirmed = predictCourseFromUnits({
      confirmed_grade: 'A',
      units: [
        { unit_code: 'U1', max_score: 100, weight: 1, is_advanced: false, exam_pct: null },
        { unit_code: 'U2', max_score: 100, weight: 1, is_advanced: true, exam_pct: null },
      ],
    });
    assert.strictEqual(manuallyConfirmed.predicted_grade, 'A');
    assert.strictEqual(manuallyConfirmed.is_finalized, true);
    assert.strictEqual(manuallyConfirmed.predicted_pct, null);
  });

  test('exam session plans are read-only on GET and enforce ownership/range/best-grade rules', async () => {
    const { getDb } = require('../db.js');
    const db = getDb();
    const studentId = 'test-student-session-guards';
    const otherStudentId = 'test-student-session-other';
    const courseId = 'test-course-session-guards';
    const otherCourseId = 'test-course-session-other';
    const enrollmentId = 'test-enrollment-session-guards';
    const unitId = 'test-course-unit-session-guards';
    const otherUnitId = 'test-course-unit-session-other';
    const sessionId = 'test-session-session-guards';
    const invalidSessionId = 'test-session-session-guards-invalid-month';

    db.prepare(
      `INSERT INTO students (id, name, grade, status, enrollment_year, study_duration)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(studentId, 'Session Guard Student', '2025级', 'active', 2025, 2);
    db.prepare(
      `INSERT INTO students (id, name, grade, status, enrollment_year, study_duration)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(otherStudentId, 'Session Guard Other', '2025级', 'active', 2025, 2);
    const insertCourse = db.prepare(
      `INSERT INTO courses (id, name, subject_code, board, grade_level, max_students)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    insertCourse.run(courseId, 'Session Guard Course', 'SGC', 'Edexcel', 'ALL', 20);
    insertCourse.run(otherCourseId, 'Session Guard Other Course', 'SGO', 'Edexcel', 'ALL', 20);
    db.prepare(
      `INSERT INTO student_courses (id, student_id, course_id, status)
       VALUES (?, ?, ?, ?)`
    ).run(enrollmentId, studentId, courseId, 'enrolled');
    db.prepare(
      `INSERT INTO course_units (id, course_id, unit_code, unit_name, max_score, weight, allowed_months)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(unitId, courseId, 'SG-U1', 'Session Guard Unit', 100, 1, JSON.stringify([5]));
    db.prepare(
      `INSERT INTO course_units (id, course_id, unit_code, unit_name, max_score, weight)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(otherUnitId, otherCourseId, 'SG-OTHER', 'Other Course Unit', 100, 1);
    db.prepare(
      `INSERT INTO unit_grades (id, student_course_id, unit_name, unit_code, score, max_score, grade, exam_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('test-session-final-grade', enrollmentId, 'Session Guard Unit', 'SG-U1', 80, 100, 'A', 'final');
    db.prepare(
      `INSERT INTO unit_grades (id, student_course_id, unit_name, unit_code, score, max_score, grade, exam_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('test-session-retake-grade', enrollmentId, 'Session Guard Unit', 'SG-U1', 60, 100, 'D', 'retake');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    const auth = { Authorization: `Bearer ${login.body.token}` };

    const before = await request(app)
      .get(`/api/exam-sessions/student/${studentId}/plans`)
      .set(auth)
      .expect(200);
    assert.strictEqual(before.body.sessions.length, 0);
    assert.strictEqual(db.prepare('SELECT COUNT(*) AS count FROM exam_sessions').get().count, 0);

    db.prepare(
      `INSERT INTO exam_sessions (id, year, month, label, board)
       VALUES (?, ?, ?, ?, ?)`
    ).run(sessionId, 2026, 5, '2026年5月', 'Edexcel');
    db.prepare(
      `INSERT INTO exam_sessions (id, year, month, label, board)
       VALUES (?, ?, ?, ?, ?)`
    ).run(invalidSessionId, 2026, 10, '2026年10月', 'Edexcel');

    const after = await request(app)
      .get(`/api/exam-sessions/student/${studentId}/plans`)
      .set(auth)
      .expect(200);
    assert.strictEqual(after.body.courses[0].units[0].best_grade.exam_type, 'final');
    assert.strictEqual(after.body.courses[0].units[0].needs_resit, false);

    await request(app)
      .post(`/api/exam-sessions/student/${studentId}/plans`)
      .set(auth)
      .send({ student_course_id: enrollmentId, course_unit_id: otherUnitId, exam_session_id: sessionId })
      .expect(400);
    await request(app)
      .post(`/api/exam-sessions/student/${studentId}/plans`)
      .set(auth)
      .send({ student_course_id: enrollmentId, course_unit_id: unitId, exam_session_id: invalidSessionId })
      .expect(400);

    const created = await request(app)
      .post(`/api/exam-sessions/student/${studentId}/plans`)
      .set(auth)
      .send({ student_course_id: enrollmentId, course_unit_id: unitId, exam_session_id: sessionId })
      .expect(201);
    await request(app)
      .post(`/api/exam-sessions/student/${studentId}/plans`)
      .set(auth)
      .send({ student_course_id: enrollmentId, course_unit_id: unitId, exam_session_id: sessionId })
      .expect(409);
    await request(app)
      .put(`/api/exam-sessions/student/${otherStudentId}/plans/${created.body.id}`)
      .set(auth)
      .send({ notes: '越权更新' })
      .expect(404);
    await request(app)
      .post(`/api/exam-sessions/student/${otherStudentId}/plans/batch`)
      .set(auth)
      .send({ plans: [{ id: created.body.id, notes: '越权批量更新' }] })
      .expect(404);
  });

  test('university catalog responses normalize polluted fields without rewriting source rows', async () => {
    const { getDb } = require('../db.js');
    const db = getDb();
    const universityId = 'test-university-catalog-normalization';
    db.prepare(
      `INSERT INTO target_universities
       (id, name, country, language_requirement, application_deadline, course_name)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(universityId, 'Catalog Normalization University', 'UCL', 'Session Guard Student [1]', 'not-a-date', 'Computer Science');
    const insertProgram = db.prepare(
      `INSERT INTO university_programs
       (id, university_id, program_name, language_requirement, application_deadline)
       VALUES (?, ?, ?, ?, ?)`
    );
    insertProgram.run('test-program-normalization-1', universityId, 'Computer Science', 'Session Guard Student [2]', '2025-01-29');
    insertProgram.run('test-program-normalization-2', universityId, 'computer science', 'IELTS 7.0 [3]', '2025-01-29');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    const auth = { Authorization: `Bearer ${login.body.token}` };
    const list = await request(app).get('/api/universities').set(auth).expect(200);
    const university = list.body.find((row) => row.id === universityId);
    assert.ok(university);
    assert.strictEqual(university.country, '其他');
    assert.strictEqual(university.language_requirement, null);
    assert.strictEqual(university.application_deadline, null);

    const programs = await request(app)
      .get(`/api/universities/${universityId}/programs`)
      .set(auth)
      .expect(200);
    assert.strictEqual(programs.body.length, 1);
    assert.strictEqual(programs.body[0].language_requirement, 'IELTS 7.0');
    assert.strictEqual(db.prepare('SELECT country, language_requirement FROM target_universities WHERE id = ?').get(universityId).country, 'UCL');
  });

  test('GET unknown API returns JSON 404', async () => {
    const res = await request(app).get('/api/no-such-route-ever').expect(404);
    assert.strictEqual(res.body.error, 'API route not found');
  });
});

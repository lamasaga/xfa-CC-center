const express = require('express');
const { randomUUID } = require('crypto');
const { z } = require('zod');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { hasPermission, requirePermission } = require('../security/permissions');
const { writeAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticateToken);

const sourceHosts = new Set([
  'www.cambridgeinternational.org',
  'cambridgeinternational.org',
  'help.cambridgeinternational.org',
  'qualifications.pearson.com',
  'www.npc.gov.cn',
  'npc.gov.cn',
  'flk.npc.gov.cn',
  'www.cac.gov.cn',
  'cac.gov.cn',
]);

function parse(schema, req, res) {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid request', issues: result.error.issues });
    return null;
  }
  return result.data;
}

function canAccessStudent(req, studentId, write = false) {
  if (req.user.role === 'student') {
    return req.user.student_id === studentId && hasPermission(req.user, write ? 'selection.write.own' : 'student.read.own');
  }
  return hasPermission(req.user, write ? 'student.write' : 'student.read');
}

function rowOr404(db, table, id, res) {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!row) res.status(404).json({ error: 'Record not found' });
  return row;
}

const academicYearSchema = z.object({
  name: z.string().trim().min(4).max(30),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['planning', 'active', 'closed']).default('planning'),
});

router.get('/overview', requirePermission('school.read'), (req, res) => {
  const db = getDb();
  const year = req.query.academic_year_id
    ? db.prepare('SELECT * FROM academic_years WHERE id = ?').get(String(req.query.academic_year_id))
    : db.prepare("SELECT * FROM academic_years ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'planning' THEN 1 ELSE 2 END, starts_on DESC LIMIT 1").get();
  if (!year) return res.json({ academic_year: null, grade_stages: [], pending_requests: 0, schedule: null, official_sources: 0 });

  const gradeStages = db.prepare(
    `SELECT school_grade, qualification_stage, COUNT(*) AS student_count
     FROM student_academic_records
     WHERE academic_year_id = ? AND status = 'active'
     GROUP BY school_grade, qualification_stage
     ORDER BY school_grade`
  ).all(year.id);
  const pending = db.prepare(
    `SELECT COUNT(*) AS count FROM course_requests
     WHERE academic_year_id = ? AND status IN ('submitted', 'teacher_review', 'school_review')`
  ).get(year.id).count;
  const offerings = db.prepare(
    `SELECT COUNT(*) AS count FROM course_offerings WHERE academic_year_id = ? AND status <> 'archived'`
  ).get(year.id).count;
  const groups = db.prepare(
    `SELECT COUNT(*) AS count FROM teaching_groups g
     JOIN course_offerings o ON o.id = g.offering_id
     WHERE o.academic_year_id = ? AND g.status <> 'archived'`
  ).get(year.id).count;
  const published = db.prepare(
    `SELECT id, name, published_at FROM schedule_versions
     WHERE academic_year_id = ? AND status = 'published'
     ORDER BY published_at DESC LIMIT 1`
  ).get(year.id) || null;
  const sources = db.prepare("SELECT COUNT(*) AS count FROM official_sources WHERE status = 'verified'").get().count;

  res.json({
    academic_year: year,
    grade_stages: gradeStages,
    pending_requests: pending,
    offering_count: offerings,
    teaching_group_count: groups,
    published_schedule: published,
    verified_source_count: sources,
  });
});

router.get('/academic-years', requirePermission('curriculum.read'), (req, res) => {
  res.json(getDb().prepare('SELECT * FROM academic_years ORDER BY starts_on DESC').all());
});

router.post('/academic-years', requirePermission('curriculum.write'), (req, res) => {
  const data = parse(academicYearSchema, req, res);
  if (!data) return;
  if (data.ends_on <= data.starts_on) return res.status(400).json({ error: 'Academic year end must be after start' });
  const row = { id: randomUUID(), ...data };
  getDb().prepare(
    `INSERT INTO academic_years (id, name, starts_on, ends_on, status) VALUES (?, ?, ?, ?, ?)`
  ).run(row.id, row.name, row.starts_on, row.ends_on, row.status);
  writeAudit(req, { action: 'academic_year.create', entityType: 'academic_year', entityId: row.id, after: row });
  res.status(201).json(row);
});

const academicRecordSchema = z.object({
  academic_year_id: z.string().min(1),
  school_grade: z.number().int().min(9).max(12),
  qualification_stage: z.enum(['IGCSE', 'AS', 'A_LEVEL']),
  homeroom: z.string().trim().max(80).nullish(),
  status: z.enum(['planned', 'active', 'completed', 'withdrawn']).default('active'),
  notes: z.string().trim().max(1000).nullish(),
});

router.get('/student-records', requirePermission('student.read'), (req, res) => {
  const yearId = String(req.query.academic_year_id || '');
  if (!yearId) return res.status(400).json({ error: 'academic_year_id required' });
  const rows = getDb().prepare(
    `SELECT s.id AS student_id, s.name, s.english_name, s.grade AS enrollment_cohort, s.status AS student_status,
            r.id, r.academic_year_id, r.school_grade, r.qualification_stage, r.homeroom, r.status, r.notes, r.updated_at
     FROM students s
     LEFT JOIN student_academic_records r ON r.student_id = s.id AND r.academic_year_id = ?
     WHERE s.status <> 'inactive'
     ORDER BY CASE WHEN r.school_grade IS NULL THEN 0 ELSE 1 END, r.school_grade, s.name`
  ).all(yearId);
  res.json(rows);
});

router.get('/student-records/:studentId', (req, res) => {
  if (!canAccessStudent(req, req.params.studentId, false)) return res.status(403).json({ error: 'No access to this student' });
  const rows = getDb().prepare(
    `SELECT r.*, y.name AS academic_year_name, y.starts_on, y.ends_on
     FROM student_academic_records r JOIN academic_years y ON y.id = r.academic_year_id
     WHERE r.student_id = ? ORDER BY y.starts_on DESC`
  ).all(req.params.studentId);
  res.json(rows);
});

router.put('/student-records/:studentId', requirePermission('student.write'), (req, res) => {
  const data = parse(academicRecordSchema, req, res);
  if (!data) return;
  const db = getDb();
  if (!rowOr404(db, 'students', req.params.studentId, res)) return;
  if (!rowOr404(db, 'academic_years', data.academic_year_id, res)) return;
  const existing = db.prepare(
    'SELECT * FROM student_academic_records WHERE student_id = ? AND academic_year_id = ?'
  ).get(req.params.studentId, data.academic_year_id);
  const id = existing?.id || randomUUID();
  db.prepare(
    `INSERT INTO student_academic_records
      (id, student_id, academic_year_id, school_grade, qualification_stage, homeroom, status, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(student_id, academic_year_id) DO UPDATE SET
       school_grade = excluded.school_grade,
       qualification_stage = excluded.qualification_stage,
       homeroom = excluded.homeroom,
       status = excluded.status,
       notes = excluded.notes,
       updated_at = CURRENT_TIMESTAMP`
  ).run(id, req.params.studentId, data.academic_year_id, data.school_grade, data.qualification_stage, data.homeroom || null, data.status, data.notes || null);
  const after = db.prepare('SELECT * FROM student_academic_records WHERE id = ?').get(id);
  writeAudit(req, { action: existing ? 'student_academic_record.update' : 'student_academic_record.create', entityType: 'student_academic_record', entityId: id, before: existing, after });
  res.json(after);
});

router.get('/official-sources', requirePermission('curriculum.read'), (req, res) => {
  const clauses = [];
  const values = [];
  if (req.query.publisher) { clauses.push('publisher = ?'); values.push(String(req.query.publisher)); }
  if (req.query.status) { clauses.push('status = ?'); values.push(String(req.query.status)); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  res.json(getDb().prepare(`SELECT * FROM official_sources ${where} ORDER BY checked_at DESC, title`).all(...values));
});

const sourceSchema = z.object({
  publisher: z.string().trim().min(2).max(100),
  source_type: z.string().trim().min(2).max(60),
  title: z.string().trim().min(3).max(300),
  url: z.string().url().max(2000),
  published_on: z.string().nullish(),
  checked_at: z.string().datetime(),
  content_hash: z.string().max(200).nullish(),
  access_level: z.enum(['public', 'centre_only']).default('public'),
  status: z.enum(['draft', 'verified', 'superseded', 'withdrawn']).default('draft'),
  supersedes_id: z.string().nullish(),
  notes: z.string().max(2000).nullish(),
});

router.post('/official-sources', requirePermission('curriculum.write'), (req, res) => {
  const data = parse(sourceSchema, req, res);
  if (!data) return;
  const url = new URL(data.url);
  if (url.protocol !== 'https:' || !sourceHosts.has(url.hostname.toLowerCase())) {
    return res.status(400).json({ error: 'Source URL is not on the approved official-domain list' });
  }
  const id = randomUUID();
  getDb().prepare(
    `INSERT INTO official_sources
      (id, publisher, source_type, title, url, published_on, checked_at, content_hash, access_level, status, verified_by, supersedes_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.publisher, data.source_type, data.title, data.url, data.published_on || null, data.checked_at, data.content_hash || null, data.access_level, data.status, data.status === 'verified' ? req.user.id : null, data.supersedes_id || null, data.notes || null);
  const after = getDb().prepare('SELECT * FROM official_sources WHERE id = ?').get(id);
  writeAudit(req, { action: 'official_source.create', entityType: 'official_source', entityId: id, after });
  res.status(201).json(after);
});

router.get('/curriculum-specs', requirePermission('curriculum.read'), (req, res) => {
  const db = getDb();
  const specs = db.prepare(
    `SELECT s.*, os.title AS source_title, os.url AS source_url, os.status AS source_status
     FROM curriculum_specs s LEFT JOIN official_sources os ON os.id = s.source_id
     ORDER BY s.qualification_level, s.subject_name, s.version_label DESC`
  ).all();
  const components = db.prepare('SELECT * FROM curriculum_components ORDER BY spec_id, sort_order, component_code').all();
  const bySpec = new Map();
  for (const component of components) {
    if (!bySpec.has(component.spec_id)) bySpec.set(component.spec_id, []);
    bySpec.get(component.spec_id).push(component);
  }
  res.json(specs.map((spec) => ({ ...spec, components: bySpec.get(spec.id) || [] })));
});

const curriculumSpecSchema = z.object({
  board: z.string().trim().min(2).max(80),
  qualification_level: z.enum(['IG', 'INTERNATIONAL_GCSE', 'IAS', 'AS', 'IAL', 'A_LEVEL']),
  subject_code: z.string().trim().min(1).max(80),
  subject_name: z.string().trim().min(2).max(200),
  school_display_name: z.string().trim().max(200).nullish(),
  version_label: z.string().trim().min(1).max(120),
  valid_exam_from: z.string().max(50).nullish(),
  valid_exam_to: z.string().max(50).nullish(),
  grading_scale: z.string().max(50).nullish(),
  assessment_model: z.enum(['linear', 'modular', 'staged', 'subject_specific']),
  source_id: z.string().nullish(),
  status: z.enum(['draft', 'active', 'expired']).default('draft'),
});

router.post('/curriculum-specs', requirePermission('curriculum.write'), (req, res) => {
  const data = parse(curriculumSpecSchema, req, res);
  if (!data) return;
  const db = getDb();
  if (data.source_id && !rowOr404(db, 'official_sources', data.source_id, res)) return;
  const id = randomUUID();
  db.prepare(
    `INSERT INTO curriculum_specs
      (id, board, qualification_level, subject_code, subject_name, school_display_name, version_label, valid_exam_from, valid_exam_to, grading_scale, assessment_model, source_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.board, data.qualification_level, data.subject_code, data.subject_name, data.school_display_name || null, data.version_label, data.valid_exam_from || null, data.valid_exam_to || null, data.grading_scale || null, data.assessment_model, data.source_id || null, data.status);
  const after = db.prepare('SELECT * FROM curriculum_specs WHERE id = ?').get(id);
  writeAudit(req, { action: 'curriculum_spec.create', entityType: 'curriculum_spec', entityId: id, after });
  res.status(201).json(after);
});

router.get('/offerings', requirePermission('curriculum.read'), (req, res) => {
  const values = [];
  const clauses = [];
  if (req.query.academic_year_id) { clauses.push('o.academic_year_id = ?'); values.push(String(req.query.academic_year_id)); }
  if (req.query.school_grade) { clauses.push('o.school_grade = ?'); values.push(Number(req.query.school_grade)); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = getDb().prepare(
    `SELECT o.*, y.name AS academic_year_name, s.board, s.subject_code, s.version_label, s.source_id,
            COUNT(DISTINCT g.id) AS teaching_group_count,
            COUNT(DISTINCT cr.id) AS request_count
     FROM course_offerings o
     JOIN academic_years y ON y.id = o.academic_year_id
     LEFT JOIN curriculum_specs s ON s.id = o.curriculum_spec_id
     LEFT JOIN teaching_groups g ON g.offering_id = o.id AND g.status <> 'archived'
     LEFT JOIN course_request_choices cr ON cr.offering_id = o.id
     ${where}
     GROUP BY o.id ORDER BY o.school_grade, o.name`
  ).all(...values);
  res.json(rows);
});

const offeringSchema = z.object({
  academic_year_id: z.string().min(1),
  curriculum_spec_id: z.string().nullish(),
  legacy_course_id: z.string().nullish(),
  name: z.string().trim().min(2).max(200),
  school_grade: z.number().int().min(9).max(12),
  qualification_stage: z.enum(['IGCSE', 'AS', 'A_LEVEL']),
  term: z.string().trim().min(1).max(60).default('full_year'),
  course_kind: z.enum(['required', 'elective']).default('elective'),
  weekly_periods: z.number().int().min(1).max(20),
  max_students: z.number().int().min(1).max(500),
  request_open_at: z.string().nullish(),
  request_close_at: z.string().nullish(),
  status: z.enum(['draft', 'open', 'closed', 'archived']).default('draft'),
  prerequisites: z.string().max(2000).nullish(),
  notes: z.string().max(2000).nullish(),
});

router.post('/offerings', requirePermission('curriculum.write'), (req, res) => {
  const data = parse(offeringSchema, req, res);
  if (!data) return;
  const db = getDb();
  if (!rowOr404(db, 'academic_years', data.academic_year_id, res)) return;
  if (data.curriculum_spec_id && !rowOr404(db, 'curriculum_specs', data.curriculum_spec_id, res)) return;
  if (data.legacy_course_id && !rowOr404(db, 'courses', data.legacy_course_id, res)) return;
  const id = randomUUID();
  db.prepare(
    `INSERT INTO course_offerings
      (id, academic_year_id, curriculum_spec_id, legacy_course_id, name, school_grade, qualification_stage, term, course_kind, weekly_periods, max_students, request_open_at, request_close_at, status, prerequisites, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.academic_year_id, data.curriculum_spec_id || null, data.legacy_course_id || null, data.name, data.school_grade, data.qualification_stage, data.term, data.course_kind, data.weekly_periods, data.max_students, data.request_open_at || null, data.request_close_at || null, data.status, data.prerequisites || null, data.notes || null);
  const after = db.prepare('SELECT * FROM course_offerings WHERE id = ?').get(id);
  writeAudit(req, { action: 'course_offering.create', entityType: 'course_offering', entityId: id, after });
  res.status(201).json(after);
});

router.get('/course-requests', (req, res) => {
  const db = getDb();
  let studentId = req.query.student_id ? String(req.query.student_id) : null;
  if (req.user.role === 'student') studentId = req.user.student_id;
  if (req.user.role !== 'student' && !hasPermission(req.user, 'selection.read')) return res.status(403).json({ error: 'No selection access' });
  const values = [];
  const clauses = [];
  if (studentId) { clauses.push('r.student_id = ?'); values.push(studentId); }
  if (req.query.academic_year_id) { clauses.push('r.academic_year_id = ?'); values.push(String(req.query.academic_year_id)); }
  if (req.query.status) { clauses.push('r.status = ?'); values.push(String(req.query.status)); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const requests = db.prepare(
    `SELECT r.*, s.name AS student_name, s.english_name, y.name AS academic_year_name, u.name AS reviewer_name
     FROM course_requests r
     JOIN students s ON s.id = r.student_id
     JOIN academic_years y ON y.id = r.academic_year_id
     LEFT JOIN users u ON u.id = r.reviewed_by
     ${where} ORDER BY r.updated_at DESC`
  ).all(...values);
  const choicesStmt = db.prepare(
    `SELECT c.*, o.name AS offering_name, o.school_grade, o.qualification_stage, o.weekly_periods, o.max_students,
            cs.board, cs.subject_code,
            (SELECT g.id FROM teaching_group_students gs
             JOIN teaching_groups g ON g.id = gs.teaching_group_id
             WHERE gs.student_id = r.student_id AND g.offering_id = c.offering_id AND gs.status = 'active' LIMIT 1) AS assigned_group_id,
            (SELECT g.code FROM teaching_group_students gs
             JOIN teaching_groups g ON g.id = gs.teaching_group_id
             WHERE gs.student_id = r.student_id AND g.offering_id = c.offering_id AND gs.status = 'active' LIMIT 1) AS assigned_group_code
     FROM course_request_choices c JOIN course_requests r ON r.id = c.request_id
     JOIN course_offerings o ON o.id = c.offering_id
     LEFT JOIN curriculum_specs cs ON cs.id = o.curriculum_spec_id
     WHERE c.request_id = ? ORDER BY c.choice_group, c.preference`
  );
  res.json(requests.map((request) => ({ ...request, choices: choicesStmt.all(request.id) })));
});

const requestSaveSchema = z.object({
  academic_year_id: z.string().min(1),
  choices: z.array(z.object({
    offering_id: z.string().min(1),
    preference: z.number().int().min(1).max(9),
    choice_group: z.string().trim().min(1).max(80).default('general'),
    reason: z.string().max(500).nullish(),
  })).max(30),
});

router.put('/course-requests/:studentId', (req, res) => {
  const studentId = req.params.studentId;
  const isOwnStudent = req.user.role === 'student' && req.user.student_id === studentId;
  if (!isOwnStudent && !hasPermission(req.user, 'selection.review')) return res.status(403).json({ error: 'No access to edit this request' });
  const data = parse(requestSaveSchema, req, res);
  if (!data) return;
  const db = getDb();
  const record = db.prepare(
    `SELECT * FROM student_academic_records WHERE student_id = ? AND academic_year_id = ? AND status IN ('planned', 'active')`
  ).get(studentId, data.academic_year_id);
  if (!record || !record.school_grade || !record.qualification_stage) {
    return res.status(409).json({ error: '请先完善该学年年级与资格阶段记录' });
  }
  const uniqueOfferings = new Set(data.choices.map((choice) => choice.offering_id));
  if (uniqueOfferings.size !== data.choices.length) return res.status(400).json({ error: '同一课程不能重复选择' });
  const offeringStmt = db.prepare(
    `SELECT * FROM course_offerings WHERE id = ? AND academic_year_id = ? AND school_grade = ? AND qualification_stage = ? AND status = 'open'`
  );
  for (const choice of data.choices) {
    if (!offeringStmt.get(choice.offering_id, data.academic_year_id, record.school_grade, record.qualification_stage)) {
      return res.status(400).json({ error: `课程 ${choice.offering_id} 不在该学生可选范围或尚未开放` });
    }
  }

  const existing = db.prepare('SELECT * FROM course_requests WHERE student_id = ? AND academic_year_id = ?').get(studentId, data.academic_year_id);
  if (existing && !['draft', 'returned'].includes(existing.status) && isOwnStudent) {
    return res.status(409).json({ error: '当前状态不可由学生修改' });
  }
  const requestId = existing?.id || randomUUID();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO course_requests (id, student_id, academic_year_id, status, updated_at)
       VALUES (?, ?, ?, 'draft', CURRENT_TIMESTAMP)
       ON CONFLICT(student_id, academic_year_id) DO UPDATE SET status = 'draft', updated_at = CURRENT_TIMESTAMP`
    ).run(requestId, studentId, data.academic_year_id);
    db.prepare('DELETE FROM course_request_choices WHERE request_id = ?').run(requestId);
    const insert = db.prepare(
      `INSERT INTO course_request_choices (id, request_id, offering_id, preference, choice_group, status, reason)
       VALUES (?, ?, ?, ?, ?, 'requested', ?)`
    );
    for (const choice of data.choices) insert.run(randomUUID(), requestId, choice.offering_id, choice.preference, choice.choice_group, choice.reason || null);
  })();
  const after = db.prepare('SELECT * FROM course_requests WHERE id = ?').get(requestId);
  writeAudit(req, { action: 'course_request.save', entityType: 'course_request', entityId: requestId, before: existing, after, metadata: { choice_count: data.choices.length } });
  res.json(after);
});

router.post('/course-requests/:requestId/submit', (req, res) => {
  const db = getDb();
  const request = rowOr404(db, 'course_requests', req.params.requestId, res);
  if (!request) return;
  const isOwn = req.user.role === 'student' && req.user.student_id === request.student_id;
  if (!isOwn && !hasPermission(req.user, 'selection.review')) return res.status(403).json({ error: 'No access to submit this request' });
  if (!['draft', 'returned'].includes(request.status)) return res.status(409).json({ error: 'Only draft or returned requests can be submitted' });
  const count = db.prepare('SELECT COUNT(*) AS count FROM course_request_choices WHERE request_id = ?').get(request.id).count;
  if (count === 0) return res.status(400).json({ error: '请至少选择一门课程' });
  db.prepare("UPDATE course_requests SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(request.id);
  writeAudit(req, { action: 'course_request.submit', entityType: 'course_request', entityId: request.id, before: request, after: { ...request, status: 'submitted' } });
  res.json({ id: request.id, status: 'submitted' });
});

const reviewSchema = z.object({
  status: z.enum(['teacher_review', 'school_review', 'approved', 'returned', 'withdrawn']),
  review_notes: z.string().max(2000).nullish(),
  choices: z.array(z.object({
    id: z.string().min(1),
    status: z.enum(['requested', 'approved', 'waitlisted', 'rejected']),
  })).optional(),
});

router.post('/course-requests/:requestId/review', requirePermission('selection.review'), (req, res) => {
  const data = parse(reviewSchema, req, res);
  if (!data) return;
  const db = getDb();
  const request = rowOr404(db, 'course_requests', req.params.requestId, res);
  if (!request) return;
  if (data.status === 'approved') {
    const approvedCount = (data.choices || []).filter((choice) => choice.status === 'approved').length;
    const existingApproved = db.prepare("SELECT COUNT(*) AS count FROM course_request_choices WHERE request_id = ? AND status = 'approved'").get(request.id).count;
    if (approvedCount + existingApproved === 0) return res.status(400).json({ error: '批准申请前至少批准一个课程选择' });
  }
  db.transaction(() => {
    if (data.choices) {
      const update = db.prepare('UPDATE course_request_choices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND request_id = ?');
      for (const choice of data.choices) update.run(choice.status, choice.id, request.id);
    }
    db.prepare(
      `UPDATE course_requests SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(data.status, req.user.id, data.review_notes || null, request.id);
  })();
  const after = db.prepare('SELECT * FROM course_requests WHERE id = ?').get(request.id);
  writeAudit(req, { action: 'course_request.review', entityType: 'course_request', entityId: request.id, before: request, after });
  res.json(after);
});

router.get('/teaching-groups', requirePermission('selection.read'), (req, res) => {
  const values = [];
  const clauses = [];
  if (req.query.academic_year_id) { clauses.push('o.academic_year_id = ?'); values.push(String(req.query.academic_year_id)); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = getDb().prepare(
    `SELECT g.*, o.name AS offering_name, o.school_grade, o.qualification_stage, o.academic_year_id,
            COUNT(DISTINCT gs.student_id) AS student_count,
            GROUP_CONCAT(DISTINCT u.name) AS teacher_names
     FROM teaching_groups g JOIN course_offerings o ON o.id = g.offering_id
     LEFT JOIN teaching_group_students gs ON gs.teaching_group_id = g.id AND gs.status = 'active'
     LEFT JOIN teaching_group_teachers gt ON gt.teaching_group_id = g.id
     LEFT JOIN users u ON u.id = gt.teacher_user_id
     ${where} GROUP BY g.id ORDER BY o.school_grade, o.name, g.code`
  ).all(...values);
  res.json(rows);
});

router.get('/teachers', requirePermission('schedule.read'), (req, res) => {
  const rows = getDb().prepare(
    `SELECT id, username, name, email, role FROM users
     WHERE role IN ('teacher', 'staff', 'admin') ORDER BY CASE role WHEN 'teacher' THEN 0 WHEN 'staff' THEN 1 ELSE 2 END, name`
  ).all();
  res.json(rows);
});

const groupSchema = z.object({
  offering_id: z.string().min(1),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(120),
  capacity: z.number().int().min(1).max(500),
  weekly_periods: z.number().int().min(1).max(20),
  consecutive_periods: z.number().int().min(1).max(4).default(1),
  teacher_user_ids: z.array(z.string().min(1)).min(1).max(6),
});

router.post('/teaching-groups', requirePermission('teaching_group.manage'), (req, res) => {
  const data = parse(groupSchema, req, res);
  if (!data) return;
  const db = getDb();
  if (!rowOr404(db, 'course_offerings', data.offering_id, res)) return;
  for (const teacherId of data.teacher_user_ids) {
    const teacher = db.prepare("SELECT id FROM users WHERE id = ? AND role IN ('teacher', 'staff', 'admin')").get(teacherId);
    if (!teacher) return res.status(400).json({ error: `Invalid teacher ${teacherId}` });
  }
  const id = randomUUID();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO teaching_groups (id, offering_id, code, name, capacity, weekly_periods, consecutive_periods)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.offering_id, data.code, data.name, data.capacity, data.weekly_periods, data.consecutive_periods);
    const insertTeacher = db.prepare('INSERT INTO teaching_group_teachers (teaching_group_id, teacher_user_id, role) VALUES (?, ?, ?)');
    data.teacher_user_ids.forEach((teacherId, index) => insertTeacher.run(id, teacherId, index === 0 ? 'lead' : 'co_teacher'));
  })();
  const after = db.prepare('SELECT * FROM teaching_groups WHERE id = ?').get(id);
  writeAudit(req, { action: 'teaching_group.create', entityType: 'teaching_group', entityId: id, after, metadata: { teachers: data.teacher_user_ids } });
  res.status(201).json(after);
});

const allocationSchema = z.object({
  student_id: z.string().min(1),
  source_request_id: z.string().nullish(),
});

router.post('/teaching-groups/:groupId/students', requirePermission('teaching_group.manage'), (req, res) => {
  const data = parse(allocationSchema, req, res);
  if (!data) return;
  const db = getDb();
  const group = db.prepare(
    `SELECT g.*, o.academic_year_id, o.school_grade, o.qualification_stage
     FROM teaching_groups g JOIN course_offerings o ON o.id = g.offering_id WHERE g.id = ?`
  ).get(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Teaching group not found' });
  const academic = db.prepare(
    `SELECT * FROM student_academic_records WHERE student_id = ? AND academic_year_id = ? AND school_grade = ? AND qualification_stage = ? AND status IN ('planned', 'active')`
  ).get(data.student_id, group.academic_year_id, group.school_grade, group.qualification_stage);
  if (!academic) return res.status(400).json({ error: 'Student academic stage does not match this teaching group' });
  const count = db.prepare("SELECT COUNT(*) AS count FROM teaching_group_students WHERE teaching_group_id = ? AND status = 'active'").get(group.id).count;
  if (count >= group.capacity) return res.status(409).json({ error: 'Teaching group is full' });
  db.prepare(
    `INSERT INTO teaching_group_students (teaching_group_id, student_id, source_request_id, status)
     VALUES (?, ?, ?, 'active')
     ON CONFLICT(teaching_group_id, student_id) DO UPDATE SET source_request_id = excluded.source_request_id, status = 'active'`
  ).run(group.id, data.student_id, data.source_request_id || null);
  writeAudit(req, { action: 'teaching_group.allocate_student', entityType: 'teaching_group', entityId: group.id, metadata: data });
  res.status(201).json({ teaching_group_id: group.id, student_id: data.student_id, status: 'active' });
});

router.get('/audit-events', requirePermission('*'), (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const rows = getDb().prepare(
    `SELECT a.*, u.name AS actor_name, u.username AS actor_username
     FROM audit_events a LEFT JOIN users u ON u.id = a.actor_user_id
     ORDER BY a.created_at DESC LIMIT ?`
  ).all(limit);
  res.json(rows);
});

module.exports = router;

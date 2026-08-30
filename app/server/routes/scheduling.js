const express = require('express');
const { randomUUID } = require('crypto');
const { z } = require('zod');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { hasPermission, requirePermission } = require('../security/permissions');
const { writeAudit } = require('../utils/audit');
const { getScheduleConflictReport, generateSchedule } = require('../services/scheduling');

const router = express.Router();
router.use(authenticateToken);

function parse(schema, req, res) {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid request', issues: result.error.issues });
    return null;
  }
  return result.data;
}

router.get('/rooms', requirePermission('schedule.read'), (req, res) => {
  res.json(getDb().prepare('SELECT * FROM rooms ORDER BY campus, code').all());
});

const roomSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(120),
  capacity: z.number().int().min(1).max(2000),
  room_type: z.string().trim().min(1).max(80).default('classroom'),
  campus: z.string().trim().max(120).nullish(),
  features: z.string().max(1000).nullish(),
});

router.post('/rooms', requirePermission('schedule.manage'), (req, res) => {
  const data = parse(roomSchema, req, res);
  if (!data) return;
  const id = randomUUID();
  getDb().prepare(
    `INSERT INTO rooms (id, code, name, capacity, room_type, campus, features) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.code, data.name, data.capacity, data.room_type, data.campus || null, data.features || null);
  const after = getDb().prepare('SELECT * FROM rooms WHERE id = ?').get(id);
  writeAudit(req, { action: 'room.create', entityType: 'room', entityId: id, after });
  res.status(201).json(after);
});

router.get('/time-slots', requirePermission('schedule.read'), (req, res) => {
  const yearId = String(req.query.academic_year_id || '');
  if (!yearId) return res.status(400).json({ error: 'academic_year_id required' });
  res.json(getDb().prepare('SELECT * FROM time_slots WHERE academic_year_id = ? ORDER BY weekday, period_no').all(yearId));
});

const bootstrapSlotsSchema = z.object({
  academic_year_id: z.string().min(1),
  periods: z.array(z.object({
    period_no: z.number().int().min(1).max(20),
    starts_at: z.string().regex(/^\d{2}:\d{2}$/),
    ends_at: z.string().regex(/^\d{2}:\d{2}$/),
    label: z.string().trim().min(1).max(50),
  })).min(1).max(20),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7).default([1, 2, 3, 4, 5]),
});

router.post('/time-slots/bootstrap', requirePermission('schedule.manage'), (req, res) => {
  const data = parse(bootstrapSlotsSchema, req, res);
  if (!data) return;
  const db = getDb();
  if (!db.prepare('SELECT 1 FROM academic_years WHERE id = ?').get(data.academic_year_id)) return res.status(404).json({ error: 'Academic year not found' });
  const insert = db.prepare(
    `INSERT INTO time_slots (id, academic_year_id, weekday, period_no, starts_at, ends_at, label)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(academic_year_id, weekday, period_no) DO UPDATE SET starts_at = excluded.starts_at, ends_at = excluded.ends_at, label = excluded.label`
  );
  let affected = 0;
  db.transaction(() => {
    for (const weekday of data.weekdays) {
      for (const period of data.periods) {
        insert.run(randomUUID(), data.academic_year_id, weekday, period.period_no, period.starts_at, period.ends_at, period.label);
        affected += 1;
      }
    }
  })();
  writeAudit(req, { action: 'time_slots.bootstrap', entityType: 'academic_year', entityId: data.academic_year_id, metadata: { affected } });
  res.status(201).json({ affected });
});

router.get('/availability', requirePermission('schedule.read'), (req, res) => {
  const teacherId = req.query.teacher_user_id ? String(req.query.teacher_user_id) : req.user.id;
  if (req.user.role === 'teacher' && teacherId !== req.user.id) return res.status(403).json({ error: 'Teachers can only view their own availability' });
  const rows = getDb().prepare(
    `SELECT a.*, ts.weekday, ts.period_no, ts.label, ts.starts_at, ts.ends_at
     FROM teacher_availability a JOIN time_slots ts ON ts.id = a.time_slot_id
     WHERE a.teacher_user_id = ? ORDER BY ts.weekday, ts.period_no`
  ).all(teacherId);
  res.json(rows);
});

const availabilitySchema = z.object({
  teacher_user_id: z.string().optional(),
  entries: z.array(z.object({
    time_slot_id: z.string().min(1),
    availability: z.enum(['available', 'preferred', 'unavailable']),
    reason: z.string().max(500).nullish(),
  })).max(200),
});

router.put('/availability', (req, res) => {
  const data = parse(availabilitySchema, req, res);
  if (!data) return;
  const teacherId = data.teacher_user_id || req.user.id;
  const isOwn = teacherId === req.user.id && hasPermission(req.user, 'availability.own');
  if (!isOwn && !hasPermission(req.user, 'schedule.manage')) return res.status(403).json({ error: 'No permission to edit availability' });
  const db = getDb();
  const teacher = db.prepare("SELECT id FROM users WHERE id = ? AND role IN ('teacher', 'staff', 'admin')").get(teacherId);
  if (!teacher) return res.status(400).json({ error: 'Teacher not found' });
  const upsert = db.prepare(
    `INSERT INTO teacher_availability (id, teacher_user_id, time_slot_id, availability, reason, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(teacher_user_id, time_slot_id) DO UPDATE SET availability = excluded.availability, reason = excluded.reason, updated_at = CURRENT_TIMESTAMP`
  );
  db.transaction(() => {
    for (const entry of data.entries) upsert.run(randomUUID(), teacherId, entry.time_slot_id, entry.availability, entry.reason || null);
  })();
  writeAudit(req, { action: 'teacher_availability.update', entityType: 'user', entityId: teacherId, metadata: { entry_count: data.entries.length } });
  res.json({ teacher_user_id: teacherId, updated: data.entries.length });
});

router.get('/versions', requirePermission('schedule.read'), (req, res) => {
  const yearId = String(req.query.academic_year_id || '');
  if (!yearId) return res.status(400).json({ error: 'academic_year_id required' });
  const rows = getDb().prepare(
    `SELECT v.*, creator.name AS creator_name, publisher.name AS publisher_name,
            COUNT(l.id) AS lesson_count, SUM(CASE WHEN l.is_locked = 1 THEN 1 ELSE 0 END) AS locked_count
     FROM schedule_versions v
     LEFT JOIN users creator ON creator.id = v.created_by
     LEFT JOIN users publisher ON publisher.id = v.published_by
     LEFT JOIN scheduled_lessons l ON l.schedule_version_id = v.id
     WHERE v.academic_year_id = ? GROUP BY v.id ORDER BY v.created_at DESC`
  ).all(yearId);
  res.json(rows);
});

const versionSchema = z.object({
  academic_year_id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  based_on_id: z.string().nullish(),
  notes: z.string().max(2000).nullish(),
});

router.post('/versions', requirePermission('schedule.manage'), (req, res) => {
  const data = parse(versionSchema, req, res);
  if (!data) return;
  const db = getDb();
  if (!db.prepare('SELECT 1 FROM academic_years WHERE id = ?').get(data.academic_year_id)) return res.status(404).json({ error: 'Academic year not found' });
  let base = null;
  if (data.based_on_id) {
    base = db.prepare('SELECT * FROM schedule_versions WHERE id = ? AND academic_year_id = ?').get(data.based_on_id, data.academic_year_id);
    if (!base) return res.status(400).json({ error: 'Base schedule not found in this academic year' });
  }
  const id = randomUUID();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO schedule_versions (id, academic_year_id, name, based_on_id, created_by, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, data.academic_year_id, data.name, data.based_on_id || null, req.user.id, data.notes || null);
    if (base) {
      db.prepare(
        `INSERT INTO scheduled_lessons
          (id, schedule_version_id, teaching_group_id, time_slot_id, room_id, teacher_user_id, is_locked, source)
         SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
                ?, teaching_group_id, time_slot_id, room_id, teacher_user_id, is_locked, source
         FROM scheduled_lessons WHERE schedule_version_id = ?`
      ).run(id, base.id);
    }
  })();
  const after = db.prepare('SELECT * FROM schedule_versions WHERE id = ?').get(id);
  writeAudit(req, { action: 'schedule_version.create', entityType: 'schedule_version', entityId: id, after });
  res.status(201).json(after);
});

router.get('/versions/:versionId/grid', requirePermission('schedule.read'), (req, res) => {
  const db = getDb();
  const version = db.prepare('SELECT * FROM schedule_versions WHERE id = ?').get(req.params.versionId);
  if (!version) return res.status(404).json({ error: 'Schedule version not found' });
  const lessons = db.prepare(
    `SELECT l.*, ts.weekday, ts.period_no, ts.label AS time_label, ts.starts_at, ts.ends_at,
            g.code AS group_code, g.name AS group_name, o.name AS offering_name, o.school_grade, o.qualification_stage,
            u.name AS teacher_name, r.code AS room_code, r.name AS room_name,
            (SELECT COUNT(*) FROM teaching_group_students gs WHERE gs.teaching_group_id = g.id AND gs.status = 'active') AS student_count
     FROM scheduled_lessons l
     JOIN time_slots ts ON ts.id = l.time_slot_id
     JOIN teaching_groups g ON g.id = l.teaching_group_id
     JOIN course_offerings o ON o.id = g.offering_id
     JOIN users u ON u.id = l.teacher_user_id
     LEFT JOIN rooms r ON r.id = l.room_id
     WHERE l.schedule_version_id = ? ORDER BY ts.weekday, ts.period_no, g.code`
  ).all(version.id);
  res.json({ version, lessons, report: getScheduleConflictReport(db, version.id) });
});

router.get('/published/me', (req, res) => {
  const db = getDb();
  const yearId = String(req.query.academic_year_id || '');
  if (!yearId) return res.status(400).json({ error: 'academic_year_id required' });
  const version = db.prepare(
    "SELECT * FROM schedule_versions WHERE academic_year_id = ? AND status = 'published' ORDER BY published_at DESC LIMIT 1"
  ).get(yearId);
  if (!version) return res.json({ version: null, lessons: [] });
  if (req.user.role === 'student') {
    const lessons = db.prepare(
      `SELECT DISTINCT l.*, ts.weekday, ts.period_no, ts.label AS time_label, ts.starts_at, ts.ends_at,
              g.code AS group_code, g.name AS group_name, o.name AS offering_name, u.name AS teacher_name, r.code AS room_code
       FROM scheduled_lessons l
       JOIN teaching_group_students gs ON gs.teaching_group_id = l.teaching_group_id AND gs.student_id = ? AND gs.status = 'active'
       JOIN time_slots ts ON ts.id = l.time_slot_id
       JOIN teaching_groups g ON g.id = l.teaching_group_id
       JOIN course_offerings o ON o.id = g.offering_id
       JOIN users u ON u.id = l.teacher_user_id LEFT JOIN rooms r ON r.id = l.room_id
       WHERE l.schedule_version_id = ? ORDER BY ts.weekday, ts.period_no`
    ).all(req.user.student_id, version.id);
    return res.json({ version, lessons });
  }
  if (!hasPermission(req.user, 'schedule.read')) return res.status(403).json({ error: 'No schedule access' });
  const lessons = db.prepare(
    `SELECT l.*, ts.weekday, ts.period_no, ts.label AS time_label, g.code AS group_code, g.name AS group_name,
            o.name AS offering_name, u.name AS teacher_name, r.code AS room_code
     FROM scheduled_lessons l JOIN time_slots ts ON ts.id = l.time_slot_id
     JOIN teaching_groups g ON g.id = l.teaching_group_id JOIN course_offerings o ON o.id = g.offering_id
     JOIN users u ON u.id = l.teacher_user_id LEFT JOIN rooms r ON r.id = l.room_id
     WHERE l.schedule_version_id = ? ORDER BY ts.weekday, ts.period_no`
  ).all(version.id);
  res.json({ version, lessons });
});

router.post('/versions/:versionId/generate', requirePermission('schedule.manage'), (req, res) => {
  try {
    const result = generateSchedule(getDb(), req.params.versionId);
    if (!result) return res.status(404).json({ error: 'Schedule version not found' });
    writeAudit(req, { action: 'schedule.generate', entityType: 'schedule_version', entityId: req.params.versionId, metadata: { generated_count: result.generated_count, unplaced_count: result.unplaced.length } });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/versions/:versionId/conflicts', requirePermission('schedule.read'), (req, res) => {
  const report = getScheduleConflictReport(getDb(), req.params.versionId);
  if (!report) return res.status(404).json({ error: 'Schedule version not found' });
  res.json(report);
});

router.post('/versions/:versionId/publish', requirePermission('schedule.publish'), (req, res) => {
  const db = getDb();
  const report = getScheduleConflictReport(db, req.params.versionId);
  if (!report) return res.status(404).json({ error: 'Schedule version not found' });
  if (!report.can_publish) return res.status(409).json({ error: '课表仍有硬冲突或未满足课时，不能发布', report });
  const before = report.version;
  db.transaction(() => {
    db.prepare("UPDATE schedule_versions SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE academic_year_id = ? AND status = 'published' AND id <> ?").run(before.academic_year_id, before.id);
    db.prepare("UPDATE schedule_versions SET status = 'published', published_by = ?, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.user.id, before.id);
  })();
  const after = db.prepare('SELECT * FROM schedule_versions WHERE id = ?').get(before.id);
  writeAudit(req, { action: 'schedule.publish', entityType: 'schedule_version', entityId: before.id, before, after });
  res.json(after);
});

const lessonSchema = z.object({
  teaching_group_id: z.string().min(1),
  time_slot_id: z.string().min(1),
  room_id: z.string().min(1),
  teacher_user_id: z.string().min(1),
  is_locked: z.boolean().default(false),
});

function validateLessonRelations(db, versionId, data) {
  const version = db.prepare('SELECT * FROM schedule_versions WHERE id = ?').get(versionId);
  if (!version) return 'Schedule version not found';
  if (version.status === 'published' || version.status === 'archived') return 'Published or archived schedules are read-only';
  const group = db.prepare(
    `SELECT g.id FROM teaching_groups g JOIN course_offerings o ON o.id = g.offering_id
     WHERE g.id = ? AND o.academic_year_id = ?`
  ).get(data.teaching_group_id, version.academic_year_id);
  if (!group) return 'Teaching group is not in this academic year';
  if (!db.prepare('SELECT 1 FROM time_slots WHERE id = ? AND academic_year_id = ? AND is_teaching = 1').get(data.time_slot_id, version.academic_year_id)) return 'Time slot is not in this academic year';
  if (!db.prepare("SELECT 1 FROM rooms WHERE id = ? AND status = 'active'").get(data.room_id)) return 'Room is unavailable';
  if (!db.prepare('SELECT 1 FROM teaching_group_teachers WHERE teaching_group_id = ? AND teacher_user_id = ?').get(data.teaching_group_id, data.teacher_user_id)) return 'Teacher is not assigned to this teaching group';
  if (db.prepare("SELECT 1 FROM teacher_availability WHERE teacher_user_id = ? AND time_slot_id = ? AND availability = 'unavailable'").get(data.teacher_user_id, data.time_slot_id)) return 'Teacher marked this time as unavailable';
  return null;
}

router.post('/versions/:versionId/lessons', requirePermission('schedule.manage'), (req, res) => {
  const data = parse(lessonSchema, req, res);
  if (!data) return;
  const db = getDb();
  const relationError = validateLessonRelations(db, req.params.versionId, data);
  if (relationError) return res.status(400).json({ error: relationError });
  const id = randomUUID();
  try {
    db.prepare(
      `INSERT INTO scheduled_lessons
       (id, schedule_version_id, teaching_group_id, time_slot_id, room_id, teacher_user_id, is_locked, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')`
    ).run(id, req.params.versionId, data.teaching_group_id, data.time_slot_id, data.room_id, data.teacher_user_id, data.is_locked ? 1 : 0);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: '该时段存在教学班、教师或教室冲突' });
    throw error;
  }
  const after = db.prepare('SELECT * FROM scheduled_lessons WHERE id = ?').get(id);
  writeAudit(req, { action: 'schedule_lesson.create', entityType: 'scheduled_lesson', entityId: id, after });
  res.status(201).json(after);
});

router.put('/versions/:versionId/lessons/:lessonId', requirePermission('schedule.manage'), (req, res) => {
  const data = parse(lessonSchema, req, res);
  if (!data) return;
  const db = getDb();
  const before = db.prepare('SELECT * FROM scheduled_lessons WHERE id = ? AND schedule_version_id = ?').get(req.params.lessonId, req.params.versionId);
  if (!before) return res.status(404).json({ error: 'Lesson not found' });
  const relationError = validateLessonRelations(db, req.params.versionId, data);
  if (relationError) return res.status(400).json({ error: relationError });
  try {
    db.prepare(
      `UPDATE scheduled_lessons SET teaching_group_id = ?, time_slot_id = ?, room_id = ?, teacher_user_id = ?, is_locked = ?, source = 'manual', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(data.teaching_group_id, data.time_slot_id, data.room_id, data.teacher_user_id, data.is_locked ? 1 : 0, before.id);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: '该时段存在教学班、教师或教室冲突' });
    throw error;
  }
  const after = db.prepare('SELECT * FROM scheduled_lessons WHERE id = ?').get(before.id);
  writeAudit(req, { action: 'schedule_lesson.update', entityType: 'scheduled_lesson', entityId: before.id, before, after });
  res.json(after);
});

router.delete('/versions/:versionId/lessons/:lessonId', requirePermission('schedule.manage'), (req, res) => {
  const db = getDb();
  const before = db.prepare(
    `SELECT l.*, v.status AS version_status FROM scheduled_lessons l JOIN schedule_versions v ON v.id = l.schedule_version_id
     WHERE l.id = ? AND l.schedule_version_id = ?`
  ).get(req.params.lessonId, req.params.versionId);
  if (!before) return res.status(404).json({ error: 'Lesson not found' });
  if (['published', 'archived'].includes(before.version_status)) return res.status(409).json({ error: 'Published or archived schedules are read-only' });
  db.prepare('DELETE FROM scheduled_lessons WHERE id = ?').run(before.id);
  writeAudit(req, { action: 'schedule_lesson.delete', entityType: 'scheduled_lesson', entityId: before.id, before });
  res.status(204).end();
});

module.exports = router;

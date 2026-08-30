const { randomUUID } = require('crypto');

function getScheduleConflictReport(db, versionId) {
  const version = db.prepare('SELECT * FROM schedule_versions WHERE id = ?').get(versionId);
  if (!version) return null;

  const studentConflicts = db.prepare(
    `SELECT l1.time_slot_id, ts.weekday, ts.period_no, gs.student_id, s.name AS student_name,
            l1.id AS lesson_a_id, g1.name AS group_a_name,
            l2.id AS lesson_b_id, g2.name AS group_b_name
     FROM scheduled_lessons l1
     JOIN scheduled_lessons l2
       ON l2.schedule_version_id = l1.schedule_version_id
      AND l2.time_slot_id = l1.time_slot_id
      AND l2.id > l1.id
     JOIN teaching_group_students gs ON gs.teaching_group_id = l1.teaching_group_id AND gs.status = 'active'
     JOIN teaching_group_students gs2 ON gs2.teaching_group_id = l2.teaching_group_id AND gs2.student_id = gs.student_id AND gs2.status = 'active'
     JOIN students s ON s.id = gs.student_id
     JOIN teaching_groups g1 ON g1.id = l1.teaching_group_id
     JOIN teaching_groups g2 ON g2.id = l2.teaching_group_id
     JOIN time_slots ts ON ts.id = l1.time_slot_id
     WHERE l1.schedule_version_id = ?
     ORDER BY ts.weekday, ts.period_no, s.name`
  ).all(versionId);

  const unavailableTeachers = db.prepare(
    `SELECT l.id AS lesson_id, l.time_slot_id, u.id AS teacher_user_id, u.name AS teacher_name,
            g.name AS group_name, ts.weekday, ts.period_no, a.reason
     FROM scheduled_lessons l
     JOIN teacher_availability a ON a.teacher_user_id = l.teacher_user_id AND a.time_slot_id = l.time_slot_id
     JOIN users u ON u.id = l.teacher_user_id
     JOIN teaching_groups g ON g.id = l.teaching_group_id
     JOIN time_slots ts ON ts.id = l.time_slot_id
     WHERE l.schedule_version_id = ? AND a.availability = 'unavailable'
     ORDER BY ts.weekday, ts.period_no, u.name`
  ).all(versionId);

  const missingPeriods = db.prepare(
    `SELECT g.id AS teaching_group_id, g.code, g.name, g.weekly_periods,
            COUNT(l.id) AS scheduled_periods,
            g.weekly_periods - COUNT(l.id) AS missing_periods
     FROM teaching_groups g
     JOIN course_offerings o ON o.id = g.offering_id
     LEFT JOIN scheduled_lessons l ON l.teaching_group_id = g.id AND l.schedule_version_id = ?
     WHERE o.academic_year_id = ? AND g.status <> 'archived'
     GROUP BY g.id HAVING COUNT(l.id) <> g.weekly_periods
     ORDER BY missing_periods DESC, g.code`
  ).all(versionId, version.academic_year_id);

  const groupsWithoutTeachers = db.prepare(
    `SELECT g.id AS teaching_group_id, g.code, g.name
     FROM teaching_groups g JOIN course_offerings o ON o.id = g.offering_id
     LEFT JOIN teaching_group_teachers gt ON gt.teaching_group_id = g.id
     WHERE o.academic_year_id = ? AND g.status <> 'archived'
     GROUP BY g.id HAVING COUNT(gt.teacher_user_id) = 0`
  ).all(version.academic_year_id);

  const roomsOverCapacity = db.prepare(
    `SELECT l.id AS lesson_id, g.code, g.name AS group_name, r.code AS room_code, r.capacity,
            COUNT(gs.student_id) AS student_count
     FROM scheduled_lessons l
     JOIN teaching_groups g ON g.id = l.teaching_group_id
     JOIN rooms r ON r.id = l.room_id
     LEFT JOIN teaching_group_students gs ON gs.teaching_group_id = g.id AND gs.status = 'active'
     WHERE l.schedule_version_id = ?
     GROUP BY l.id HAVING COUNT(gs.student_id) > r.capacity`
  ).all(versionId);

  const hardConflictCount = studentConflicts.length + unavailableTeachers.length + groupsWithoutTeachers.length + roomsOverCapacity.length;
  const missingPeriodCount = missingPeriods.reduce((sum, row) => sum + Math.max(0, Number(row.missing_periods) || 0), 0);
  return {
    version,
    hard_conflict_count: hardConflictCount,
    missing_period_count: missingPeriodCount,
    can_publish: hardConflictCount === 0 && missingPeriodCount === 0,
    student_conflicts: studentConflicts,
    unavailable_teachers: unavailableTeachers,
    groups_without_teachers: groupsWithoutTeachers,
    rooms_over_capacity: roomsOverCapacity,
    missing_periods: missingPeriods,
  };
}

function generateSchedule(db, versionId) {
  const version = db.prepare('SELECT * FROM schedule_versions WHERE id = ?').get(versionId);
  if (!version) return null;
  if (version.status === 'published' || version.status === 'archived') {
    const error = new Error('Published or archived schedules cannot be regenerated');
    error.statusCode = 409;
    throw error;
  }

  const slots = db.prepare(
    `SELECT * FROM time_slots WHERE academic_year_id = ? AND is_teaching = 1 ORDER BY weekday, period_no`
  ).all(version.academic_year_id);
  const rooms = db.prepare("SELECT * FROM rooms WHERE status = 'active' ORDER BY capacity, code").all();
  const groups = db.prepare(
    `SELECT g.*, o.name AS offering_name,
            (SELECT teacher_user_id FROM teaching_group_teachers gt WHERE gt.teaching_group_id = g.id ORDER BY CASE gt.role WHEN 'lead' THEN 0 ELSE 1 END LIMIT 1) AS teacher_user_id,
            (SELECT COUNT(*) FROM teaching_group_students gs WHERE gs.teaching_group_id = g.id AND gs.status = 'active') AS student_count
     FROM teaching_groups g JOIN course_offerings o ON o.id = g.offering_id
     WHERE o.academic_year_id = ? AND g.status <> 'archived'
     ORDER BY g.weekly_periods DESC, g.capacity DESC, g.code`
  ).all(version.academic_year_id);

  const availabilityRows = db.prepare(
    `SELECT teacher_user_id, time_slot_id, availability FROM teacher_availability
     WHERE time_slot_id IN (SELECT id FROM time_slots WHERE academic_year_id = ?)`
  ).all(version.academic_year_id);
  const availability = new Map(availabilityRows.map((row) => [`${row.teacher_user_id}|${row.time_slot_id}`, row.availability]));
  const studentsByGroup = new Map();
  const allGroupStudents = db.prepare(
    `SELECT gs.teaching_group_id, gs.student_id FROM teaching_group_students gs
     JOIN teaching_groups g ON g.id = gs.teaching_group_id
     JOIN course_offerings o ON o.id = g.offering_id
     WHERE o.academic_year_id = ? AND gs.status = 'active'`
  ).all(version.academic_year_id);
  for (const row of allGroupStudents) {
    if (!studentsByGroup.has(row.teaching_group_id)) studentsByGroup.set(row.teaching_group_id, []);
    studentsByGroup.get(row.teaching_group_id).push(row.student_id);
  }

  const generated = [];
  const unplaced = [];
  db.transaction(() => {
    db.prepare("DELETE FROM scheduled_lessons WHERE schedule_version_id = ? AND is_locked = 0 AND source = 'generated'").run(versionId);
    const existing = db.prepare('SELECT * FROM scheduled_lessons WHERE schedule_version_id = ?').all(versionId);
    const teacherBusy = new Set(existing.map((row) => `${row.teacher_user_id}|${row.time_slot_id}`));
    const roomBusy = new Set(existing.filter((row) => row.room_id).map((row) => `${row.room_id}|${row.time_slot_id}`));
    const groupBusy = new Set(existing.map((row) => `${row.teaching_group_id}|${row.time_slot_id}`));
    const studentBusy = new Set();
    const scheduledDays = new Map();
    for (const lesson of existing) {
      const slot = slots.find((item) => item.id === lesson.time_slot_id);
      if (slot) {
        const key = `${lesson.teaching_group_id}|${slot.weekday}`;
        scheduledDays.set(key, (scheduledDays.get(key) || 0) + 1);
      }
      for (const studentId of studentsByGroup.get(lesson.teaching_group_id) || []) {
        studentBusy.add(`${studentId}|${lesson.time_slot_id}`);
      }
    }
    const insert = db.prepare(
      `INSERT INTO scheduled_lessons
       (id, schedule_version_id, teaching_group_id, time_slot_id, room_id, teacher_user_id, is_locked, source)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'generated')`
    );

    for (const group of groups) {
      const already = existing.filter((lesson) => lesson.teaching_group_id === group.id).length;
      let remaining = Math.max(0, group.weekly_periods - already);
      if (!group.teacher_user_id) {
        unplaced.push({ teaching_group_id: group.id, group_name: group.name, remaining, reason: '未指定教师' });
        continue;
      }
      const groupStudents = studentsByGroup.get(group.id) || [];
      while (remaining > 0) {
        const candidates = [];
        for (const slot of slots) {
          if (groupBusy.has(`${group.id}|${slot.id}`) || teacherBusy.has(`${group.teacher_user_id}|${slot.id}`)) continue;
          const teacherAvailability = availability.get(`${group.teacher_user_id}|${slot.id}`) || 'available';
          if (teacherAvailability === 'unavailable') continue;
          if (groupStudents.some((studentId) => studentBusy.has(`${studentId}|${slot.id}`))) continue;
          const minimumCapacity = Math.max(1, Number(group.student_count) || 0);
          const room = rooms.find((item) => item.capacity >= minimumCapacity && !roomBusy.has(`${item.id}|${slot.id}`));
          if (!room) continue;
          const sameDay = scheduledDays.get(`${group.id}|${slot.weekday}`) || 0;
          const score = sameDay * 100 + (teacherAvailability === 'preferred' ? -20 : 0) + slot.period_no;
          candidates.push({ slot, room, score });
        }
        candidates.sort((a, b) => a.score - b.score || a.slot.weekday - b.slot.weekday || a.slot.period_no - b.slot.period_no || a.room.capacity - b.room.capacity);
        const selected = candidates[0];
        if (!selected) {
          unplaced.push({ teaching_group_id: group.id, group_name: group.name, remaining, reason: '没有满足教师、学生和教室硬约束的时段' });
          break;
        }
        const lesson = {
          id: randomUUID(),
          schedule_version_id: versionId,
          teaching_group_id: group.id,
          time_slot_id: selected.slot.id,
          room_id: selected.room.id,
          teacher_user_id: group.teacher_user_id,
        };
        insert.run(lesson.id, lesson.schedule_version_id, lesson.teaching_group_id, lesson.time_slot_id, lesson.room_id, lesson.teacher_user_id);
        generated.push(lesson);
        groupBusy.add(`${group.id}|${selected.slot.id}`);
        teacherBusy.add(`${group.teacher_user_id}|${selected.slot.id}`);
        roomBusy.add(`${selected.room.id}|${selected.slot.id}`);
        for (const studentId of groupStudents) studentBusy.add(`${studentId}|${selected.slot.id}`);
        const dayKey = `${group.id}|${selected.slot.weekday}`;
        scheduledDays.set(dayKey, (scheduledDays.get(dayKey) || 0) + 1);
        remaining -= 1;
      }
    }
    db.prepare("UPDATE schedule_versions SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(versionId);
  })();

  return { generated_count: generated.length, generated, unplaced, report: getScheduleConflictReport(db, versionId) };
}

module.exports = { getScheduleConflictReport, generateSchedule };

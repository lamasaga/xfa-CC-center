const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbAsync, getDb } = require('../db');
const {
  authenticateToken,
  canModifyExamSessions,
  assertOwnStudentParam,
  requireNotStudent,
} = require('../middleware/auth');
const {
  ensureExamSessionsForStudent,
  filterSessionsForStudent,
  normalizeAllowedMonthsList,
} = require('../utils/examSessionRange');

const router = express.Router();

async function ensureSessionsForStudent(enrollmentYear, studyDuration, boardName = 'Edexcel') {
  await ensureExamSessionsForStudent(
    enrollmentYear,
    studyDuration,
    boardName,
    dbAsync,
    uuidv4
  );
}

// ========== 考季 CRUD ==========

// 获取所有考季
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { board, year } = req.query;
    let sessions = await dbAsync.findAll('exam_sessions');

    if (board) sessions = sessions.filter(s => s.board === board);
    if (year) sessions = sessions.filter(s => s.year === parseInt(year));

    sessions.sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year);
    res.json(sessions);
  } catch (error) {
    console.error('Get exam sessions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 创建考季
router.post('/', authenticateToken, requireNotStudent, canModifyExamSessions, async (req, res) => {
  try {
    const { year, month, label, board, registration_deadline, results_date } = req.body;
    if (!year || !month || !label) {
      return res.status(400).json({ error: '年份、月份和标签为必填项' });
    }

    const existing = await dbAsync.query(
      'SELECT id FROM exam_sessions WHERE year = ? AND month = ? AND board = ?',
      [year, month, board || 'Edexcel']
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: '该考季已存在' });
    }

    const session = await dbAsync.create('exam_sessions', {
      id: uuidv4(),
      year,
      month,
      label,
      board: board || 'Edexcel',
      registration_deadline: registration_deadline || null,
      results_date: results_date || null,
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('Create exam session error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 批量自动生成考季（根据入学年和学制）
router.post('/generate', authenticateToken, requireNotStudent, canModifyExamSessions, async (req, res) => {
  try {
    const { enrollment_year, study_duration, board } = req.body;
    if (!enrollment_year) {
      return res.status(400).json({ error: '入学年份为必填项' });
    }

    const duration = study_duration || 2;
    const boardName = board || 'Edexcel';

    await ensureSessionsForStudent(enrollment_year, duration, boardName);

    const allSessions = await dbAsync.findAll('exam_sessions');
    const sessions = filterSessionsForStudent(allSessions, enrollment_year, duration).filter(
      (s) => s.board === boardName
    );

    res.status(201).json({ created: sessions.length, sessions });
  } catch (error) {
    console.error('Generate exam sessions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 删除考季
router.delete('/:id', authenticateToken, requireNotStudent, canModifyExamSessions, async (req, res) => {
  try {
    const plans = await dbAsync.findAll('session_unit_plans', { exam_session_id: req.params.id });
    if (plans.length > 0) {
      return res.status(400).json({ error: '该考季下已有分配的单元，无法删除' });
    }
    await dbAsync.delete('exam_sessions', req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete exam session error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== 学生考季规划 ==========

// 获取某学生的完整考季规划
router.get(
  '/student/:studentId/plans',
  authenticateToken,
  assertOwnStudentParam('studentId'),
  async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await dbAsync.findById('students', studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const studyDuration = student.study_duration || 2;
    const enrollmentYear = student.enrollment_year || new Date().getFullYear();

    await ensureSessionsForStudent(enrollmentYear, studyDuration, 'Edexcel');

    const allSessions = await dbAsync.findAll('exam_sessions');
    const sessions = filterSessionsForStudent(allSessions, enrollmentYear, studyDuration);

    // 获取学生选课
    const studentCourses = await dbAsync.findAll('student_courses', { student_id: studentId });
    const courses = [];

    for (const sc of studentCourses) {
      if (sc.status === 'dropped') continue;

      const course = await dbAsync.findById('courses', sc.course_id);
      if (!course) continue;

      // 获取课程单元配置
      const units = await dbAsync.findAll('course_units', { course_id: sc.course_id });
      units.sort((a, b) => a.sort_order - b.sort_order);

      // 获取已有成绩
      const unitGrades = await dbAsync.findAll('unit_grades', { student_course_id: sc.id });

      // 获取已有的考季分配
      const plans = await dbAsync.findAll('session_unit_plans', { student_course_id: sc.id });

      const unitsWithGrades = units.map(u => {
        const grades = unitGrades.filter(g => g.unit_code === u.unit_code);
        const finalGrade = grades.find(g => g.exam_type === 'final');
        const retakeGrade = grades.find(g => g.exam_type === 'retake');
        const bestGrade = retakeGrade || finalGrade;

        const needsResit = finalGrade &&
          finalGrade.grade &&
          ['D', 'E', 'U'].includes(finalGrade.grade);

        let allowedMonths = null;
        if (u.allowed_months) {
          try {
            const parsed = JSON.parse(u.allowed_months);
            if (Array.isArray(parsed)) {
              allowedMonths = normalizeAllowedMonthsList(parsed);
            }
          } catch {
            // ignore parse error
          }
        }

        return {
          unit_id: u.id,
          unit_code: u.unit_code,
          unit_name: u.unit_name,
          max_score: u.max_score,
          best_grade: bestGrade ? {
            score: bestGrade.score,
            grade: bestGrade.grade,
            exam_type: bestGrade.exam_type,
            exam_date: bestGrade.exam_date,
          } : null,
          needs_resit: !!needsResit,
          allowed_months: allowedMonths,
        };
      });

      courses.push({
        student_course_id: sc.id,
        course_id: sc.course_id,
        course_name: course.name,
        subject_code: course.subject_code,
        board: course.board,
        units: unitsWithGrades,
        plans: plans.map(p => ({
          id: p.id,
          course_unit_id: p.course_unit_id,
          exam_session_id: p.exam_session_id,
          plan_type: p.plan_type,
          status: p.status,
          notes: p.notes,
        })),
      });
    }

    res.json({
      student: {
        id: student.id,
        name: student.name,
        study_duration: studyDuration,
        enrollment_year: enrollmentYear,
      },
      sessions,
      courses,
    });
  } catch (error) {
    console.error('Get session plans error:', error);
    res.status(500).json({ error: 'Server error' });
  }
  }
);

// 创建/分配单元到考季
router.post('/student/:studentId/plans', authenticateToken, canModifyExamSessions, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { student_course_id, course_unit_id, exam_session_id, plan_type, notes } = req.body;

    if (!student_course_id || !course_unit_id || !exam_session_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 验证学生选课归属
    const sc = await dbAsync.findById('student_courses', student_course_id);
    if (!sc || sc.student_id !== studentId) {
      return res.status(400).json({ error: '选课记录不匹配' });
    }

    const plan = await dbAsync.create('session_unit_plans', {
      id: uuidv4(),
      student_course_id,
      course_unit_id,
      exam_session_id,
      plan_type: plan_type || 'first_sit',
      status: 'planned',
      notes: notes || null,
    });

    res.status(201).json(plan);
  } catch (error) {
    console.error('Create session plan error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 更新分配
router.put('/student/:studentId/plans/:planId', authenticateToken, canModifyExamSessions, async (req, res) => {
  try {
    const { planId } = req.params;
    const { exam_session_id, plan_type, status, notes } = req.body;

    const updateData = { updated_at: new Date().toISOString() };
    if (exam_session_id !== undefined) updateData.exam_session_id = exam_session_id;
    if (plan_type !== undefined) updateData.plan_type = plan_type;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await dbAsync.update('session_unit_plans', planId, updateData);
    if (!updated) return res.status(404).json({ error: 'Plan not found' });

    res.json(updated);
  } catch (error) {
    console.error('Update session plan error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 删除分配
router.delete('/student/:studentId/plans/:planId', authenticateToken, canModifyExamSessions, async (req, res) => {
  try {
    await dbAsync.delete('session_unit_plans', req.params.planId);
    res.status(204).send();
  } catch (error) {
    console.error('Delete session plan error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 批量更新分配（看板拖拽保存）
router.post('/student/:studentId/plans/batch', authenticateToken, canModifyExamSessions, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { plans } = req.body;

    if (!Array.isArray(plans)) {
      return res.status(400).json({ error: 'plans must be an array' });
    }

    const db = getDb();
    const results = [];

    const transaction = db.transaction(() => {
      for (const plan of plans) {
        if (plan.id && plan._delete) {
          db.prepare('DELETE FROM session_unit_plans WHERE id = ?').run(plan.id);
          continue;
        }

        if (plan.id) {
          // Update existing
          const sets = [];
          const vals = [];
          if (plan.exam_session_id !== undefined) { sets.push('exam_session_id = ?'); vals.push(plan.exam_session_id); }
          if (plan.plan_type !== undefined) { sets.push('plan_type = ?'); vals.push(plan.plan_type); }
          if (plan.status !== undefined) { sets.push('status = ?'); vals.push(plan.status); }
          if (plan.notes !== undefined) { sets.push('notes = ?'); vals.push(plan.notes); }
          sets.push('updated_at = ?'); vals.push(new Date().toISOString());
          vals.push(plan.id);
          db.prepare(`UPDATE session_unit_plans SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
          results.push({ id: plan.id, action: 'updated' });
        } else {
          // Create new
          const id = uuidv4();
          db.prepare(`
            INSERT INTO session_unit_plans (id, student_course_id, course_unit_id, exam_session_id, plan_type, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            id,
            plan.student_course_id,
            plan.course_unit_id,
            plan.exam_session_id,
            plan.plan_type || 'first_sit',
            plan.status || 'planned',
            plan.notes || null
          );
          results.push({ id, action: 'created' });
        }
      }
    });

    transaction();
    res.json({ results });
  } catch (error) {
    console.error('Batch update session plans error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 获取学生考季概览（仪表盘用）
router.get(
  '/student/:studentId/overview',
  authenticateToken,
  assertOwnStudentParam('studentId'),
  async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await dbAsync.findById('students', studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const studyDuration = student.study_duration || 2;
    const enrollmentYear = student.enrollment_year || new Date().getFullYear();

    await ensureSessionsForStudent(enrollmentYear, studyDuration, 'Edexcel');

    const allSessions = await dbAsync.findAll('exam_sessions');
    const sessions = filterSessionsForStudent(allSessions, enrollmentYear, studyDuration);

    // 找到下一个考季
    const now = new Date();
    const nextSession = sessions.find(s => {
      const sessionDate = new Date(s.year, s.month - 1, 1);
      return sessionDate > now;
    });

    const calcDaysUntil = (isoDate) => {
      if (!isoDate) return null;
      const t = new Date(isoDate).getTime();
      if (!Number.isFinite(t)) return null;
      return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
    };

    // 获取全部规划
    const studentCourses = await dbAsync.findAll('student_courses', { student_id: studentId });
    const allPlans = [];
    const coursesSummary = [];
    const unplannedUnits = [];
    const resitUnplannedUnits = [];

    for (const sc of studentCourses) {
      if (sc.status === 'dropped') continue;
      const course = await dbAsync.findById('courses', sc.course_id);
      if (!course) continue;

      const units = await dbAsync.findAll('course_units', { course_id: sc.course_id });
      const plans = await dbAsync.findAll('session_unit_plans', { student_course_id: sc.id });
      const unitGrades = await dbAsync.findAll('unit_grades', { student_course_id: sc.id });

      let resitCount = 0;
      for (const u of units) {
        const finalGrade = unitGrades.find(g => g.unit_code === u.unit_code && g.exam_type === 'final');
        if (finalGrade && finalGrade.grade && ['D', 'E', 'U'].includes(finalGrade.grade)) {
          resitCount++;
        }
      }

      const plannedUnits = new Set(plans.map(p => p.course_unit_id));
      for (const u of units) {
        if (!plannedUnits.has(u.id)) {
          unplannedUnits.push({
            student_course_id: sc.id,
            course_id: sc.course_id,
            course_name: course.name,
            unit_id: u.id,
            unit_code: u.unit_code,
            unit_name: u.unit_name,
          });
          const finalGrade = unitGrades.find(g => g.unit_code === u.unit_code && g.exam_type === 'final');
          if (finalGrade && finalGrade.grade && ['D', 'E', 'U'].includes(finalGrade.grade)) {
            resitUnplannedUnits.push({
              student_course_id: sc.id,
              course_id: sc.course_id,
              course_name: course.name,
              unit_id: u.id,
              unit_code: u.unit_code,
              unit_name: u.unit_name,
              final_grade: finalGrade.grade,
            });
          }
        }
      }

      coursesSummary.push({
        course_name: course.name,
        board: course.board,
        total_units: units.length,
        planned_units: plannedUnits.size,
        completed_units: plans.filter(p => p.status === 'completed').length,
        resit_needed: resitCount,
      });

      for (const p of plans) {
        const unit = units.find(u => u.id === p.course_unit_id);
        allPlans.push({
          ...p,
          course_name: course.name,
          unit_code: unit ? unit.unit_code : '?',
          unit_name: unit ? unit.unit_name : '?',
        });
      }
    }

    // 下一考季报考的单元
    const nextSessionPlans = nextSession
      ? allPlans.filter(p => p.exam_session_id === nextSession.id && p.status !== 'cancelled')
      : [];

    // 剩余可用考季数
    const remainingSessions = sessions.filter(s => {
      const sessionDate = new Date(s.year, s.month - 1, 1);
      return sessionDate > now;
    }).length;

    res.json({
      next_session: nextSession || null,
      next_session_deadlines: nextSession ? {
        registration_deadline: nextSession.registration_deadline || null,
        results_date: nextSession.results_date || null,
        days_until_registration: calcDaysUntil(nextSession.registration_deadline),
      } : null,
      next_session_plans: nextSessionPlans,
      courses_summary: coursesSummary,
      unplanned_units: unplannedUnits,
      resit_unplanned_units: resitUnplannedUnits,
      remaining_sessions: remainingSessions,
      total_resit_needed: coursesSummary.reduce((sum, c) => sum + c.resit_needed, 0),
    });
  } catch (error) {
    console.error('Get session overview error:', error);
    res.status(500).json({ error: 'Server error' });
  }
  }
);

module.exports = router;

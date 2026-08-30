const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbAsync, getDb } = require('../db');
const { authenticateToken, canModify } = require('../middleware/auth');
const { courseVisibleForStudent } = require('../utils/gradeMatch');
const { normalizeAllowedMonthsList } = require('../utils/examSessionRange');
const { getFlexibleUnitRule } = require('../utils/courseUnits');
const {
  percentageFor,
  selectBestActualExamUnits,
  roundOneDecimal,
} = require('../utils/actualExamScores');

const router = express.Router();

function assertCourseEnrolledOrStaff(req, res, next) {
  if (!req.user || req.user.role !== 'student') return next();
  const courseId = req.params.id;
  const row = getDb()
    .prepare(
      `SELECT 1 AS x FROM student_courses WHERE course_id = ? AND student_id = ? AND COALESCE(status,'') != 'dropped' LIMIT 1`
    )
    .get(courseId, req.user.student_id);
  if (!row) {
    return res.status(403).json({ error: '无权查看该课程' });
  }
  next();
}

function scoreDateKey(unitGrade) {
  return String(unitGrade?.exam_date || unitGrade?.created_at || '');
}

// 课程详情是读取接口：保留 student_courses 中的旧汇总字段，同时从 unit_grades
// 派生可展示的成绩，避免导入的历史单元成绩因未回填旧字段而在页面中消失。
function buildScoreSummary(unitGrades, courseUnits = []) {
  const summarizeRecent = (examType) => {
    const rows = unitGrades
      .filter((row) => row.exam_type === examType && percentageFor(row) !== null)
      .sort((a, b) => scoreDateKey(b).localeCompare(scoreDateKey(a)))
      .slice(0, 2);
    if (rows.length === 0) return { score: null, grade: null, count: 0 };
    const score = rows.reduce((sum, row) => sum + percentageFor(row), 0) / rows.length;
    const grades = [...new Set(rows.map((row) => String(row.grade || '').trim()).filter(Boolean))];
    return {
      score: roundOneDecimal(score),
      grade: grades.length === 1 ? grades[0] : null,
      count: rows.length,
    };
  };

  // 实考/重考同一单元只取最好一次，防止重考被重复计入平均值。
  const finalRows = selectBestActualExamUnits(unitGrades, courseUnits);
  const finalGrades = [...new Set(finalRows.map(({ row }) => String(row.grade || '').trim()).filter(Boolean))];
  const finalScore = finalRows.length
    ? roundOneDecimal(finalRows.reduce((sum, { percentage }) => sum + percentage, 0) / finalRows.length)
    : null;
  const finalUnits = finalRows
    .map(({ row, percentage }) => ({
      unit_code: row.unit_code || '',
      unit_name: row.unit_name || '',
      score: Number(row.score),
      max_score: Number(row.max_score),
      percentage: roundOneDecimal(percentage),
      exam_type: row.exam_type,
      exam_date: row.exam_date || null,
    }))
    .sort((a, b) => a.unit_code.localeCompare(b.unit_code, undefined, { numeric: true }));

  return {
    internal: summarizeRecent('internal'),
    mock: summarizeRecent('mock'),
    final: {
      score: finalScore,
      grade: finalGrades.length === 1 ? finalGrades[0] : null,
      count: finalRows.length,
      units: finalUnits,
    },
  };
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { grade_level } = req.query;
    let courses = await dbAsync.findAll('courses');
    
    if (grade_level) {
      courses = courses.filter((c) => courseVisibleForStudent(c.grade_level, grade_level));
    }

    // 添加教师名称和学生数量
    const coursesWithDetails = await Promise.all(
      courses.map(async (course) => {
        const teacher = await dbAsync.findById('users', course.teacher_id);
        const enrollments = await dbAsync.findAll('student_courses', { course_id: course.id });
        return {
          ...course,
          teacher_name: teacher ? teacher.name : null,
          student_count: enrollments.length
        };
      })
    );

    res.json(coursesWithDetails);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/detail', authenticateToken, assertCourseEnrolledOrStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const course = await dbAsync.findById('courses', id);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const teacher = await dbAsync.findById('users', course.teacher_id);
    course.teacher_name = teacher ? teacher.name : null;

    // 获取所有学生（学生账号仅返回本人行）
    let enrollments = await dbAsync.findAll('student_courses', { course_id: id });
    const courseUnits = await dbAsync.findAll('course_units', { course_id: id });
    if (req.user.role === 'student') {
      enrollments = enrollments.filter((e) => e.student_id === req.user.student_id);
    }
    const students = (
      await Promise.all(
        enrollments.map(async (sc) => {
          const student = await dbAsync.findById('students', sc.student_id);
          if (!student) return null;
          const unitGrades = await dbAsync.findAll('unit_grades', { student_course_id: sc.id });
          const score_summary = buildScoreSummary(unitGrades, courseUnits);
          return {
            ...sc,
            student_id: student.id,
            student_name: student.name,
            english_name: student.english_name,
            grade: student.grade,
            unitGrades,
            score_summary,
          };
        })
      )
    ).filter(Boolean);

    // 统计
    // 单元成绩优先；旧汇总字段仅作为历史兼容回退。
    const scoreFor = (student, type) => {
      const derived = student.score_summary?.[type]?.score;
      if (typeof derived === 'number') return derived;
      const legacy = Number(student[`${type}_score`]);
      return Number.isFinite(legacy) && legacy > 0 ? legacy : null;
    };
    const internalScores = students.map((s) => scoreFor(s, 'internal')).filter((score) => score !== null);
    const mockScores = students.map((s) => scoreFor(s, 'mock')).filter((score) => score !== null);
    const finalScores = students.map((s) => scoreFor(s, 'final')).filter((score) => score !== null);

    const stats = {
      total_students: students.length,
      avg_internal: internalScores.length ? internalScores.reduce((a, b) => a + b, 0) / internalScores.length : 0,
      avg_mock: mockScores.length ? mockScores.reduce((a, b) => a + b, 0) / mockScores.length : 0,
      avg_final: finalScores.length ? finalScores.reduce((a, b) => a + b, 0) / finalScores.length : 0,
      max_internal: internalScores.length ? Math.max(...internalScores) : 0,
      min_internal: internalScores.length ? Math.min(...internalScores) : 0,
      max_final: finalScores.length ? Math.max(...finalScores) : 0,
      min_final: finalScores.length ? Math.min(...finalScores) : 0,
      students_with_final: finalScores.length,
    };

    // 等级分布
    const gradeCounts = {};
    students.forEach(s => {
      if (s.internal_grade) {
        gradeCounts[s.internal_grade] = (gradeCounts[s.internal_grade] || 0) + 1;
      }
    });
    const gradeDistribution = Object.entries(gradeCounts).map(([grade, count]) => ({ grade, count }));

    res.json({ course, students, stats, gradeDistribution });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 创建课程
router.post('/', authenticateToken, canModify, async (req, res) => {
  try {
    const { name, subject_code, board, grade_level, teacher_id, academic_year, semester, max_students, description } = req.body;
    
    if (!name || !board) {
      return res.status(400).json({ error: 'Name and board required' });
    }

    const ay = typeof academic_year === 'string' && academic_year.trim() !== '' ? academic_year.trim() : '';

    const course = {
      id: uuidv4(),
      name,
      subject_code: subject_code || '',
      board,
      grade_level: 'ALL',
      teacher_id: teacher_id || null,
      academic_year: ay,
      semester: semester || 'Fall',
      max_students: max_students || 20,
      description: description || '',
      created_at: new Date().toISOString()
    };

    await dbAsync.create('courses', course);
    res.status(201).json(course);
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 更新课程
router.put('/:id', authenticateToken, canModify, async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = ['name', 'subject_code', 'board', 'grade_level', 'teacher_id', 'academic_year', 'semester', 'max_students', 'description'];
    
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.grade_level = 'ALL';

    const course = await dbAsync.update('courses', id, updates);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 删除课程
router.delete('/:id', authenticateToken, canModify, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await dbAsync.delete('courses', id);
    if (!deleted) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 学生选课
router.post('/:id/enroll', authenticateToken, canModify, async (req, res) => {
  try {
    const { id } = req.params;
    const { student_id } = req.body;

    if (!student_id) {
      return res.status(400).json({ error: 'student_id required' });
    }

    // 检查是否已选课
    const existing = await dbAsync.findAll('student_courses', { course_id: id, student_id });
    const activeEnrollment = existing.find((row) => row.status !== 'dropped');
    if (activeEnrollment) {
      return res.status(400).json({ error: 'Student already enrolled' });
    }
    const droppedEnrollment = existing.find((row) => row.status === 'dropped');
    if (droppedEnrollment) {
      const restored = await dbAsync.update('student_courses', droppedEnrollment.id, {
        status: 'enrolled',
        updated_at: new Date().toISOString(),
      });
      return res.json({ ...restored, restored: true });
    }

    const enrollment = {
      id: uuidv4(),
      student_id,
      course_id: id,
      internal_grade: '',
      internal_score: 0,
      mock_grade: '',
      mock_score: 0,
      final_grade: '',
      final_score: 0,
      status: 'enrolled',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await dbAsync.create('student_courses', enrollment);
    res.status(201).json(enrollment);
  } catch (error) {
    console.error('Enroll student error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 从学生当前课程列表移除：保留选课、单元成绩与考季计划，便于历史追溯和重新加入。
router.delete('/:id/enroll/:studentId', authenticateToken, canModify, async (req, res) => {
  try {
    const enrollments = await dbAsync.findAll('student_courses', {
      course_id: req.params.id,
      student_id: req.params.studentId,
    });
    const enrollment = enrollments.find((row) => row.status !== 'dropped');
    if (!enrollment) return res.status(404).json({ error: 'Student is not actively enrolled in this course' });

    const updated = await dbAsync.update('student_courses', enrollment.id, {
      status: 'dropped',
      updated_at: new Date().toISOString(),
    });
    res.json({ ...updated, message: 'Course removed from active student view; historical records retained' });
  } catch (error) {
    console.error('Remove student course error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 更新学生成绩
router.put('/:id/grades/:studentId', authenticateToken, canModify, async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const { internal_grade, internal_score, mock_grade, mock_score, final_grade, final_score } = req.body;

    // 查找学生选课记录
    const enrollments = await dbAsync.findAll('student_courses', { course_id: id, student_id: studentId });
    if (enrollments.length === 0) {
      return res.status(404).json({ error: 'Student not enrolled in this course' });
    }

    const enrollmentId = enrollments[0].id;
    const updates = {
      ...(internal_grade !== undefined && { internal_grade }),
      ...(internal_score !== undefined && { internal_score }),
      ...(mock_grade !== undefined && { mock_grade }),
      ...(mock_score !== undefined && { mock_score }),
      ...(final_grade !== undefined && { final_grade }),
      ...(final_score !== undefined && { final_score }),
      updated_at: new Date().toISOString()
    };

    const updated = await dbAsync.update('student_courses', enrollmentId, updates);
    res.json(updated);
  } catch (error) {
    console.error('Update grades error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 添加单元成绩
router.post('/:id/unit-grades/:studentId', authenticateToken, canModify, async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const { unit_name, unit_code, score, max_score, grade, exam_date, exam_type } = req.body;

    // 查找学生选课记录
    const enrollments = await dbAsync.findAll('student_courses', { course_id: id, student_id: studentId });
    if (enrollments.length === 0) {
      return res.status(404).json({ error: 'Student not enrolled in this course' });
    }

    const studentCourseId = enrollments[0].id;

    const numericScore = Number(score);
    const numericMaxScore = Number(max_score);
    if (!Number.isFinite(numericScore) || numericScore < 0) {
      return res.status(400).json({ error: '得分必须为 0 或正数' });
    }
    if (!Number.isFinite(numericMaxScore) || numericMaxScore <= 0) {
      return res.status(400).json({ error: '满分必须大于 0' });
    }
    const unitGrade = {
      id: uuidv4(),
      student_course_id: studentCourseId,
      unit_name: unit_name || '',
      unit_code: unit_code || '',
      score: numericScore,
      max_score: numericMaxScore,
      grade: grade || '',
      exam_date: exam_date || null,
      exam_type: exam_type || 'internal',
      created_at: new Date().toISOString()
    };

    await dbAsync.create('unit_grades', unitGrade);
    res.status(201).json(unitGrade);
  } catch (error) {
    console.error('Add unit grade error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 修改单元成绩；保留记录 ID，避免影响与该学生选课相关的历史关联。
router.put('/unit-grades/:unitGradeId', authenticateToken, canModify, async (req, res) => {
  try {
    const existing = await dbAsync.findById('unit_grades', req.params.unitGradeId);
    if (!existing) return res.status(404).json({ error: 'Unit grade not found' });

    const allowed = ['unit_name', 'unit_code', 'score', 'max_score', 'grade', 'exam_date', 'exam_type'];
    const updates = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (updates.score !== undefined) {
      const score = Number(updates.score);
      if (!Number.isFinite(score) || score < 0) return res.status(400).json({ error: '得分必须为 0 或正数' });
      updates.score = score;
    }
    if (updates.max_score !== undefined) {
      const maxScore = Number(updates.max_score);
      if (!Number.isFinite(maxScore) || maxScore <= 0) return res.status(400).json({ error: '满分必须大于 0' });
      updates.max_score = maxScore;
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields' });

    const updated = await dbAsync.update('unit_grades', existing.id, updates);
    res.json(updated);
  } catch (error) {
    console.error('Update unit grade error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 删除单元成绩
router.delete('/unit-grades/:unitGradeId', authenticateToken, canModify, async (req, res) => {
  try {
    const { unitGradeId } = req.params;
    const deleted = await dbAsync.delete('unit_grades', unitGradeId);
    if (!deleted) {
      return res.status(404).json({ error: 'Unit grade not found' });
    }
    res.json({ message: 'Unit grade deleted successfully' });
  } catch (error) {
    console.error('Delete unit grade error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// === 课程单元配置 ===

// 获取课程的单元列表
router.get('/:id/units', authenticateToken, assertCourseEnrolledOrStaff, async (req, res) => {
  try {
    const units = await dbAsync.findAll('course_units', { course_id: req.params.id });
    units.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const normalized = units.map(u => {
      let allowed_months = null;
      if (u.allowed_months) {
        try {
          const parsed = JSON.parse(u.allowed_months);
          if (Array.isArray(parsed)) {
            allowed_months = normalizeAllowedMonthsList(parsed);
          }
        } catch {
          allowed_months = null;
        }
      }
      return { ...u, allowed_months };
    });
    res.json(normalized);
  } catch (error) {
    console.error('Get course units error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 添加课程单元
router.post('/:id/units', authenticateToken, canModify, async (req, res) => {
  try {
    const { unit_code, unit_name, is_advanced, is_required, max_score, weight, description, sort_order, allowed_months } = req.body;
    if (!unit_code || !unit_name) return res.status(400).json({ error: 'unit_code and unit_name required' });

    const course = await dbAsync.findById('courses', req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const unit = {
      id: uuidv4(),
      course_id: req.params.id,
      unit_code, unit_name,
      is_advanced: is_advanced ? 1 : 0,
      // 数学/进阶数学的计分组合由学生的成绩与考季计划决定，不能用单个单元的可选标记代替。
      is_required: getFlexibleUnitRule(course) ? 1 : (is_required === false || is_required === 0 ? 0 : 1),
      max_score: max_score || 100,
      weight: weight || 1.0,
      description: description || '',
      sort_order: sort_order || 0,
      allowed_months: Array.isArray(allowed_months) && allowed_months.length > 0
        ? JSON.stringify(normalizeAllowedMonthsList(allowed_months))
        : null,
      created_at: new Date().toISOString(),
    };
    await dbAsync.create('course_units', unit);
    res.status(201).json(unit);
  } catch (error) {
    console.error('Add course unit error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 更新课程单元
router.put('/:id/units/:unitId', authenticateToken, canModify, async (req, res) => {
  try {
    const allowed = ['unit_code', 'unit_name', 'is_advanced', 'is_required', 'max_score', 'weight', 'description', 'sort_order', 'allowed_months'];
    const updates = {};
    for (const f of allowed) {
      if (req.body[f] !== undefined) {
        if (f === 'is_advanced') {
          updates[f] = req.body[f] ? 1 : 0;
        } else if (f === 'is_required') {
          const course = await dbAsync.findById('courses', req.params.id);
          updates[f] = getFlexibleUnitRule(course) ? 1 : (req.body[f] === false || req.body[f] === 0 ? 0 : 1);
        } else if (f === 'allowed_months') {
          const months = Array.isArray(req.body[f]) ? req.body[f] : [];
          updates[f] = months.length > 0
            ? JSON.stringify(normalizeAllowedMonthsList(months))
            : null;
        } else {
          updates[f] = req.body[f];
        }
      }
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields' });

    const updated = await dbAsync.update('course_units', req.params.unitId, updates);
    if (!updated) return res.status(404).json({ error: 'Unit not found' });
    res.json(updated);
  } catch (error) {
    console.error('Update course unit error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 删除课程单元
router.delete('/:id/units/:unitId', authenticateToken, canModify, async (req, res) => {
  try {
    const deleted = await dbAsync.delete('course_units', req.params.unitId);
    if (!deleted) return res.status(404).json({ error: 'Unit not found' });
    res.json({ message: 'Course unit deleted' });
  } catch (error) {
    console.error('Delete course unit error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 一键复制：将某年级的课程（含单元配置）复制到新年级
router.post('/clone-grade', authenticateToken, canModify, async (req, res) => {
  try {
    const { from_grade, to_grade } = req.body || {};
    const fromGrade = String(from_grade || '').trim();
    const toGrade = String(to_grade || '').trim();
    if (!fromGrade || !toGrade) return res.status(400).json({ error: 'from_grade and to_grade required' });
    if (fromGrade === toGrade) return res.status(400).json({ error: 'from_grade and to_grade must be different' });

    const db = getDb();

    const tx = db.transaction(() => {
      const srcCourses = db.prepare('SELECT * FROM courses WHERE grade_level = ?').all(fromGrade);
      const findDst = db.prepare('SELECT * FROM courses WHERE grade_level = ? AND name = ? AND board = ? AND (subject_code = ? OR subject_code IS NULL OR subject_code = \'\') LIMIT 1');
      const insertCourse = db.prepare(
        `INSERT INTO courses (id, name, subject_code, board, grade_level, teacher_id, academic_year, semester, max_students, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const srcUnitsStmt = db.prepare('SELECT * FROM course_units WHERE course_id = ? ORDER BY sort_order ASC');
      const dstUnitsStmt = db.prepare('SELECT * FROM course_units WHERE course_id = ?');
      const insertUnit = db.prepare(
        `INSERT INTO course_units (id, course_id, unit_code, unit_name, is_advanced, is_required, max_score, weight, description, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      let createdCourses = 0;
      let copiedUnits = 0;
      let skippedCourses = 0;
      let skippedUnits = 0;

      for (const c of srcCourses) {
        const dst = findDst.get(toGrade, c.name, c.board, c.subject_code || '');
        let dstCourseId = dst?.id;
        if (!dstCourseId) {
          dstCourseId = uuidv4();
          insertCourse.run(
            dstCourseId,
            c.name,
            c.subject_code || '',
            c.board,
            toGrade,
            c.teacher_id || null,
            c.academic_year || null,
            c.semester || null,
            c.max_students || 20,
            c.description || '',
            new Date().toISOString()
          );
          createdCourses += 1;
        } else {
          skippedCourses += 1;
        }

        // 单元复制：若目标课程已有单元，则默认不重复复制
        const existingUnits = dstUnitsStmt.all(dstCourseId);
        if (existingUnits.length > 0) {
          skippedUnits += srcUnitsStmt.all(c.id).length;
          continue;
        }

        const srcUnits = srcUnitsStmt.all(c.id);
        for (const u of srcUnits) {
          insertUnit.run(
            uuidv4(),
            dstCourseId,
            u.unit_code,
            u.unit_name,
            u.is_advanced ? 1 : 0,
            u.is_required === 0 || u.is_required === false ? 0 : 1,
            u.max_score || 100,
            u.weight || 1.0,
            u.description || '',
            u.sort_order || 0,
            new Date().toISOString()
          );
          copiedUnits += 1;
        }
      }

      return { createdCourses, copiedUnits, skippedCourses, skippedUnits };
    });

    const result = tx();
    res.json(result);
  } catch (error) {
    console.error('Clone grade courses error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

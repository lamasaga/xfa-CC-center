const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db');
const {
  authenticateToken,
  canModify,
  canManageStudentLifecycle,
  requireNotStudent,
  assertOwnStudentParam,
} = require('../middleware/auth');
const { buildStudentUsername, ensureUniqueUsername } = require('../utils/studentAccount');
const { defaultStudentInitialPassword } = require('../config');
const { predictCourseFromUnits } = require('../services/alevel-prediction');
const {
  studentMatchesGradeFilter,
  computeExpectedGraduationMonth,
  extractYear,
  courseVisibleForStudent,
  normalizeGradeToCanonical,
} = require('../utils/gradeMatch');

const router = express.Router();

const uploadsStudentsDir = path.join(__dirname, '../../uploads/students');

function ensureUploadsStudentsDir() {
  fs.mkdirSync(uploadsStudentsDir, { recursive: true });
}

function removeStudentAvatarFiles(studentId) {
  const id = String(studentId || '').trim();
  if (!id) return;
  try {
    ensureUploadsStudentsDir();
    for (const n of fs.readdirSync(uploadsStudentsDir)) {
      if (n === `${id}.jpg` || n === `${id}.jpeg` || n === `${id}.png` || n === `${id}.webp`) {
        fs.unlinkSync(path.join(uploadsStudentsDir, n));
      }
    }
  } catch (e) {
    console.warn('removeStudentAvatarFiles:', e.message);
  }
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadsStudentsDir();
    cb(null, uploadsStudentsDir);
  },
  filename: (req, file, cb) => {
    const id = String(req.params.id || '').trim();
    const mime = file.mimetype || '';
    const ext = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg';
    cb(null, `${id}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 800 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('仅支持 JPG、PNG、WebP 格式的图片'));
  },
});

/** 默认关闭上传；设为 true 并重启 Node 后开放 POST /api/students/:id/avatar（与前端 STUDENT_AVATAR_UPLOAD_UI_ENABLED 同步开启更安全） */
function isStudentAvatarUploadEnabled() {
  return String(process.env.ENABLE_STUDENT_AVATAR_UPLOAD || '').trim().toLowerCase() === 'true';
}

// 获取所有学生（支持筛选）
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { grade, status, search } = req.query;
    
    let students = await dbAsync.findAll('students');

    if (req.user.role === 'student') {
      students = students.filter((s) => s.id === req.user.student_id);
    }

    // 应用筛选（入学年份与「2024级」展示一致）
    if (grade) {
      students = students.filter((s) => studentMatchesGradeFilter(s, grade));
    }

    if (status) {
      students = students.filter(s => s.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      students = students.filter(s => 
        s.name.toLowerCase().includes(searchLower) ||
        (s.english_name && s.english_name.toLowerCase().includes(searchLower))
      );
    }

    // 排序
    students.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // 为每个学生获取概览统计
    const studentsWithStats = [];
    for (const student of students) {
      try {
        const stats = await getStudentStats(student.id);
        // 获取顾问名称
        const advisor = await dbAsync.findById('users', student.advisor_id);
        studentsWithStats.push({ 
          ...student, 
          stats,
          advisor_name: advisor ? advisor.name : null
        });
      } catch (err) {
        console.error(`Error processing student ${student.id}:`, err);
        // 即使出错也添加学生，但 stats 为空
        studentsWithStats.push({ 
          ...student, 
          stats: {
            courseCount: 0,
            avgInternalScore: 0,
            hasLanguageScore: false,
            bestIelts: null,
            universityCount: 0,
            offerCount: 0,
            pendingTasks: 0
          },
          advisor_name: null
        });
      }
    }

    res.json(studentsWithStats);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 获取年级整体统计
router.get('/grade-overview/:grade', authenticateToken, requireNotStudent, async (req, res) => {
  try {
    const { grade } = req.params;

    // 获取该年级所有学生
    let students = await dbAsync.findAll('students', { status: 'active' });
    students = students.filter((s) => studentMatchesGradeFilter(s, grade));
    const studentIds = students.map(s => s.id);

    // 课程统计：含 ALL 及同届课程
    const allCoursesRaw = await dbAsync.findAll('courses');
    const allCourses = allCoursesRaw.filter((c) => courseVisibleForStudent(c.grade_level, grade));
    const courseStats = await Promise.all(
      allCourses.map(async (course) => {
        const enrollments = await dbAsync.findAll('student_courses', { course_id: course.id });
        const scores = enrollments.map(e => e.internal_score).filter(Boolean);
        const mocks = enrollments.map(e => e.mock_score).filter(Boolean);
        
        return {
          name: course.name,
          board: course.board,
          student_count: enrollments.length,
          avg_internal: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
          avg_mock: mocks.length ? mocks.reduce((a, b) => a + b, 0) / mocks.length : 0
        };
      })
    );

    // 大学申请统计
    const allStudentUnis = await dbAsync.findAll('student_universities');
    const studentUnis = allStudentUnis.filter(su => studentIds.includes(su.student_id));
    
    const universityStats = {
      applying_count: studentUnis.filter(su => ['interested', 'applying', 'submitted'].includes(su.status)).length,
      offer_count: studentUnis.filter(su => su.status === 'offer').length,
      submitted_count: studentUnis.filter(su => su.status === 'submitted').length
    };

    // 语言成绩统计
    const allLangScores = await dbAsync.findAll('language_scores', { is_best_score: 1 });
    const studentLangScores = allLangScores.filter(ls => studentIds.includes(ls.student_id));
    
    const ieltsScores = studentLangScores.map(ls => ls.overall_score).filter(Boolean);
    const languageStats = {
      avg_ielts: ieltsScores.length ? ieltsScores.reduce((a, b) => a + b, 0) / ieltsScores.length : 0,
      max_ielts: ieltsScores.length ? Math.max(...ieltsScores) : 0,
      has_ielts: studentLangScores.length
    };

    res.json({
      grade,
      totalStudents: students.length,
      courseStats,
      universityStats,
      languageStats
    });
  } catch (error) {
    console.error('Get grade overview error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 升学中心工作台：风险/待跟进概览
router.get('/workbench', authenticateToken, requireNotStudent, async (req, res) => {
  try {
    const { grade, course_id, university_id } = req.query;
    const gradeFilter = grade ? String(grade) : null;
    const courseFilter = course_id ? String(course_id) : null;
    const universityFilter = university_id ? String(university_id) : null;

    let students = await dbAsync.findAll('students');
    students = students.filter(s => s.status === 'active');
    if (gradeFilter) students = students.filter((s) => studentMatchesGradeFilter(s, gradeFilter));

    // 先按课程/目标院校筛选学生集合，避免全量计算
    if (courseFilter) {
      const allStudentCourses = await dbAsync.findAll('student_courses');
      const enrolled = new Set(
        allStudentCourses
          .filter((sc) => sc.course_id === courseFilter && sc.status !== 'dropped')
          .map((sc) => sc.student_id)
      );
      students = students.filter((s) => enrolled.has(s.id));
    }

    if (universityFilter) {
      const allStudentUnis = await dbAsync.findAll('student_universities');
      const hasUni = new Set(
        allStudentUnis
          .filter((su) => su.university_id === universityFilter)
          .map((su) => su.student_id)
      );
      students = students.filter((s) => hasUni.has(s.id));
    }

    const now = Date.now();
    const inDays = (d) => now + d * 24 * 60 * 60 * 1000;

    const results = [];
    for (const s of students) {
      const [bestIeltsRows, tasks, studentCourses] = await Promise.all([
        dbAsync.findAll('language_scores', { student_id: s.id, is_best_score: 1, test_type: 'IELTS' }),
        dbAsync.findAll('tasks', { student_id: s.id }),
        dbAsync.findAll('student_courses', { student_id: s.id }),
      ]);

      const bestIelts = bestIeltsRows?.[0]?.overall_score ?? null;

      const pendingTasks = tasks.filter(t => ['pending', 'in_progress'].includes(t.status));
      const urgentTasks = pendingTasks.filter(t => {
        if (!t.deadline) return false;
        const ts = new Date(t.deadline).getTime();
        return Number.isFinite(ts) && ts <= inDays(7);
      });
      const upcomingTasks = pendingTasks.filter(t => {
        if (!t.deadline) return false;
        const ts = new Date(t.deadline).getTime();
        return Number.isFinite(ts) && ts <= inDays(30);
      });

      // resit needed: any final unit grade in D/E/U
      let resitNeeded = 0;
      let resitUnitSamples = [];
      // unplanned: course_units not yet planned in session_unit_plans
      let unplannedUnits = 0;

      for (const sc of studentCourses) {
        if (sc.status === 'dropped') continue;
        const [units, plans, unitGrades] = await Promise.all([
          dbAsync.findAll('course_units', { course_id: sc.course_id }),
          dbAsync.findAll('session_unit_plans', { student_course_id: sc.id }),
          dbAsync.findAll('unit_grades', { student_course_id: sc.id }),
        ]);

        const plannedUnitIds = new Set(plans.map(p => p.course_unit_id));
        for (const u of units) {
          if (!plannedUnitIds.has(u.id)) unplannedUnits += 1;
          const fg = unitGrades.find(g => g.unit_code === u.unit_code && g.exam_type === 'final');
          if (fg && fg.grade && ['D', 'E', 'U'].includes(fg.grade)) {
            resitNeeded += 1;
            if (resitUnitSamples.length < 5) {
              resitUnitSamples.push({ unit_code: u.unit_code, grade: fg.grade });
            }
          }
        }
      }

      const reasons = [];
      if (!bestIelts) reasons.push('缺少IELTS最佳成绩');
      if (resitNeeded > 0) reasons.push(`需重考单元 ${resitNeeded}`);
      if (unplannedUnits > 0) reasons.push(`未安排考季单元 ${unplannedUnits}`);
      if (urgentTasks.length > 0) reasons.push(`7天内到期任务 ${urgentTasks.length}`);

      // risk score
      const riskScore =
        (bestIelts ? 0 : 3) +
        (resitNeeded > 0 ? Math.min(10, resitNeeded) * 2 : 0) +
        (unplannedUnits > 0 ? Math.min(10, unplannedUnits) * 0.5 : 0) +
        (urgentTasks.length > 0 ? urgentTasks.length * 1.5 : 0);

      results.push({
        student_id: s.id,
        name: s.name,
        english_name: s.english_name || null,
        grade: s.grade,
        advisor_id: s.advisor_id || null,
        best_ielts: bestIelts,
        pending_tasks: pendingTasks.length,
        urgent_tasks_7d: urgentTasks.length,
        upcoming_tasks_30d: upcomingTasks.length,
        resit_needed: resitNeeded,
        unplanned_units: unplannedUnits,
        resit_units_sample: resitUnitSamples,
        reasons,
        risk_score: Math.round(riskScore * 10) / 10,
      });
    }

    results.sort((a, b) => (b.risk_score - a.risk_score) || (b.urgent_tasks_7d - a.urgent_tasks_7d));
    res.json({ grade: gradeFilter, total: results.length, items: results });
  } catch (error) {
    console.error('Get workbench error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 获取单个学生完整信息（仪表盘数据）
router.get('/:id/dashboard', authenticateToken, assertOwnStudentParam('id'), async (req, res) => {
  try {
    const { id } = req.params;

    // 获取学生基本信息
    const student = await dbAsync.findById('students', id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // 获取顾问名称
    const advisor = await dbAsync.findById('users', student.advisor_id);
    student.advisor_name = advisor ? advisor.name : null;

    // 获取课程和成绩
    const studentCourses = await dbAsync.findAll('student_courses', { student_id: id });
    const courses = await Promise.all(
      studentCourses.map(async (sc) => {
        const course = await dbAsync.findById('courses', sc.course_id);
        const unitGrades = await dbAsync.findAll('unit_grades', { student_course_id: sc.id });
        const courseUnits = await dbAsync.findAll('course_units', { course_id: sc.course_id });
        courseUnits.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        return {
          ...sc,
          course_name: course ? course.name : null,
          subject_code: course ? course.subject_code : null,
          board: course ? course.board : null,
          unitGrades,
          courseUnits
        };
      })
    );

    // 获取语言成绩
    const languageScores = await dbAsync.findAll('language_scores', { student_id: id });

    // 获取标化考试成绩
    const standardizedTests = await dbAsync.findAll('standardized_tests', { student_id: id });

    // 获取目标院校（创建顺序：用于默认「第一个冲刺」等逻辑）
    let studentUnis = await dbAsync.findAll('student_universities', { student_id: id });
    studentUnis = [...studentUnis].sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );
    const parseJsonCol = (raw, fallback) => {
      if (raw == null || raw === '') return fallback;
      if (typeof raw === 'object') return raw;
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    };
    const targetUniversities = await Promise.all(
      studentUnis.map(async (su) => {
        const uni = await dbAsync.findById('target_universities', su.university_id);
        let programRow = null;
        if (su.program_id) {
          programRow = await dbAsync.findById('university_programs', su.program_id);
        }
        return {
          ...su,
          ...uni,
          student_university_id: su.id,
          university_record_id: uni.id,
          matching_prefs: parseJsonCol(su.matching_prefs, null),
          offer_detail: parseJsonCol(su.offer_detail, null),
          program_name: programRow ? programRow.program_name : null,
          program: programRow,
        };
      })
    );

    // 获取课外活动
    const extracurriculars = await dbAsync.findAll('extracurriculars', { student_id: id });

    // 获取任务
    const tasks = await dbAsync.findAll('tasks', { student_id: id });
    tasks.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    res.json({
      student,
      courses,
      languageScores,
      standardizedTests,
      targetUniversities,
      extracurriculars,
      tasks
    });
  } catch (error) {
    console.error('Get student dashboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 上传学生头像（学生本人或教务/管理员/指导老师；单文件 ≤800KB；默认关闭见 isStudentAvatarUploadEnabled）
router.post(
  '/:id/avatar',
  authenticateToken,
  assertOwnStudentParam('id'),
  (req, res, next) => {
    if (!isStudentAvatarUploadEnabled()) {
      return res.status(403).json({
        error: '学生头像上传功能已关闭',
        hint: '需要启用时请将环境变量 ENABLE_STUDENT_AVATAR_UPLOAD 设为 true 并重启服务，同时在前端打开 STUDENT_AVATAR_UPLOAD_UI_ENABLED。',
      });
    }
    next();
  },
  (req, res, next) => {
    removeStudentAvatarFiles(req.params.id);
    next();
  },
  (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) {
        const msg = err.message || '上传失败';
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ error: msg });
      }
      if (!req.file) {
        return res.status(400).json({ error: '请选择图片文件（字段名 avatar）' });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { id } = req.params;
      const publicPath = `/uploads/students/${req.file.filename}`;
      const now = new Date().toISOString();
      await dbAsync.update('students', id, { avatar_url: publicPath, updated_at: now });
      res.json({ avatar_url: publicPath, updated_at: now });
    } catch (error) {
      console.error('Upload avatar error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// 基于“实考/重考单元成绩”推算最终成绩（用于目标院校匹配）
router.get('/:id/alevel-predictions', authenticateToken, assertOwnStudentParam('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const student = await dbAsync.findById('students', id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const studentCourses = await dbAsync.findAll('student_courses', { student_id: id });
    const results = [];

    for (const sc of studentCourses) {
      if (sc.status === 'dropped') continue;
      const course = await dbAsync.findById('courses', sc.course_id);
      if (!course) continue;
      // 校内课程不参与标化推算与匹配
      if (String(course.board || '').trim() === 'Internal') continue;

      const [courseUnits, unitGrades] = await Promise.all([
        dbAsync.findAll('course_units', { course_id: sc.course_id }),
        dbAsync.findAll('unit_grades', { student_course_id: sc.id }),
      ]);
      courseUnits.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      // 取“实考/重考”里每个单元的最好得分率（若没有，则视为未考）
      const bestPctByUnitCode = {};
      for (const g of unitGrades) {
        if (!g.unit_code) continue;
        if (g.exam_type !== 'final' && g.exam_type !== 'retake') continue;
        const denom = g.max_score || 100;
        if (!denom) continue;
        const pct = Math.max(0, Math.min(1, (g.score || 0) / denom));
        const key = String(g.unit_code).trim().toLowerCase();
        bestPctByUnitCode[key] = Math.max(bestPctByUnitCode[key] || 0, pct);
      }

      const units = courseUnits.map(u => {
        const key = String(u.unit_code || '').trim().toLowerCase();
        const exam_pct = key && bestPctByUnitCode[key] != null ? bestPctByUnitCode[key] : null;
        return {
          unit_code: u.unit_code,
          max_score: typeof u.max_score === 'number' && u.max_score > 0 ? u.max_score : 100,
          weight: typeof u.weight === 'number' && u.weight > 0 ? u.weight : 1,
          is_advanced: !!u.is_advanced,
          exam_pct,
        };
      });

      // 没有单元配置时：无法推算（返回空）
      if (!units.length) continue;

      results.push(
        predictCourseFromUnits({
          course_id: sc.course_id,
          course_name: course.name,
          board: course.board,
          student_course_id: sc.id,
          units,
        })
      );
    }

    res.json({
      student_id: id,
      generated_at: new Date().toISOString(),
      predictions: results,
    });
  } catch (error) {
    console.error('Get alevel predictions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 获取单个学生
router.get('/:id', authenticateToken, assertOwnStudentParam('id'), async (req, res) => {
  try {
    const { id } = req.params;

    const student = await dbAsync.findById('students', id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const advisor = await dbAsync.findById('users', student.advisor_id);
    student.advisor_name = advisor ? advisor.name : null;

    res.json(student);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 创建学生（仅教务/管理员；自动创建学生登录账号，初始密码见 config.defaultStudentInitialPassword）
router.post('/', authenticateToken, canManageStudentLifecycle, async (req, res) => {
  try {
    const {
      name, english_name, grade, school, enrollment_year: eyBody,
      study_duration: sdBody,
      expected_graduation_month: egmBody,
      phone, email, wechat, parent_name, parent_phone, parent_email,
      class_track: classTrackBody,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }

    const englishTrim = String(english_name || '').trim();
    if (!englishTrim) {
      return res.status(400).json({ error: '英文姓名为必填，用于生成学生登录账号' });
    }

    const gradeNorm = normalizeGradeToCanonical(grade) || grade;
    let enrollment_year = eyBody != null ? parseInt(String(eyBody), 10) : null;
    if (!Number.isFinite(enrollment_year)) {
      const fromGrade = gradeNorm || grade ? extractYear(gradeNorm || grade) : null;
      enrollment_year = fromGrade ? parseInt(fromGrade, 10) : new Date().getFullYear();
    }
    const gradeDisplay = `${enrollment_year}级`;
    const study_duration = sdBody != null ? parseInt(String(sdBody), 10) : 2;
    const sd = Number.isFinite(study_duration) && study_duration > 0 ? study_duration : 2;

    let expected_graduation_month = egmBody;
    if (!expected_graduation_month || !String(expected_graduation_month).trim()) {
      expected_graduation_month = computeExpectedGraduationMonth(enrollment_year, sd);
    }

    let class_track = null;
    if (classTrackBody === 'international' || classTrackBody === 'domestic') {
      class_track = classTrackBody;
    }

    const student = {
      id: uuidv4(),
      name,
      english_name: englishTrim,
      grade: gradeDisplay,
      school: school || '',
      enrollment_year,
      study_duration: sd,
      expected_graduation_month,
      class_track,
      advisor_id: req.user.id,
      phone: phone || '',
      email: email || '',
      wechat: wechat || '',
      parent_name: parent_name || '',
      parent_phone: parent_phone || '',
      parent_email: parent_email || '',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let loginUsername;
    try {
      loginUsername = await ensureUniqueUsername(
        buildStudentUsername({
          english_name: englishTrim,
          enrollment_year,
        })
      );
    } catch (e) {
      return res.status(400).json({ error: e.message || '无法生成登录用户名' });
    }

    await dbAsync.create('students', student);

    const initialPassword = defaultStudentInitialPassword;
    const hashedPassword = await bcrypt.hash(initialPassword, 10);
    try {
      await dbAsync.create('users', {
        id: uuidv4(),
        username: loginUsername,
        password: hashedPassword,
        name,
        email: email || '',
        role: 'student',
        student_id: student.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (userErr) {
      console.error('Create student user rollback:', userErr);
      await dbAsync.delete('students', student.id);
      return res.status(500).json({ error: '学生档案已创建，但登录账号写入失败，请重试或联系管理员' });
    }

    res.status(201).json({
      student,
      student_account: {
        username: loginUsername,
        initial_password: initialPassword,
      },
    });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 更新学生
router.put('/:id', authenticateToken, canModify, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await dbAsync.findById('students', id);
    if (!existing) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const allowedFields = [
      'name', 'english_name', 'grade', 'school', 'enrollment_year',
      'study_duration',
      'expected_graduation_month',
      'class_track',
      'phone', 'email', 'wechat', 'parent_name', 'parent_phone',
      'parent_email', 'status', 'advisor_id'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // 请求里只要带了「年级」文案，就以年级为准同步 enrollment_year（避免前端 editForm 仍带旧 enrollment_year 把年级改回去）
    if (updates.grade !== undefined) {
      const ng = normalizeGradeToCanonical(updates.grade) || updates.grade;
      const yStr = extractYear(ng);
      if (yStr) {
        const y = parseInt(yStr, 10);
        if (Number.isFinite(y)) {
          updates.enrollment_year = y;
          updates.grade = `${y}级`;
        }
      }
    }

    if (updates.class_track !== undefined) {
      const v = updates.class_track;
      if (v !== null && v !== '' && v !== 'international' && v !== 'domestic') {
        delete updates.class_track;
      }
    }

    if (updates.grade === undefined && updates.enrollment_year !== undefined) {
      const y = parseInt(String(updates.enrollment_year), 10);
      if (Number.isFinite(y)) {
        updates.enrollment_year = y;
        updates.grade = `${y}级`;
      }
    }

    const mergedEy = updates.enrollment_year ?? existing.enrollment_year;
    const mergedSd = updates.study_duration ?? existing.study_duration ?? 2;
    const shouldRecomputeGrad =
      (updates.enrollment_year !== undefined || updates.study_duration !== undefined) &&
      req.body.expected_graduation_month === undefined;

    if (shouldRecomputeGrad && mergedEy != null) {
      updates.expected_graduation_month = computeExpectedGraduationMonth(
        mergedEy,
        Number(mergedSd) || 2
      );
    }

    const student = await dbAsync.update('students', id, updates);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(student);
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 删除学生（仅教务/管理员；同步删除绑定学生账号）
router.delete('/:id', authenticateToken, canManageStudentLifecycle, async (req, res) => {
  try {
    const { id } = req.params;

    removeStudentAvatarFiles(id);

    const linkedUsers = await dbAsync.findAll('users', { student_id: id });
    for (const u of linkedUsers) {
      await dbAsync.delete('users', u.id);
    }

    const deleted = await dbAsync.delete('students', id);
    if (!deleted) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// === 语言成绩 CRUD ===

// 添加语言成绩
router.post('/:id/language-scores', authenticateToken, canModify, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      test_type,
      overall_score,
      listening_score,
      reading_score,
      writing_score,
      speaking_score,
      component_scores,
      test_date,
      valid_until,
      is_best_score
    } = req.body;

    if (!test_type || overall_score === undefined || !test_date) {
      return res.status(400).json({ error: 'test_type, overall_score and test_date required' });
    }

    const student = await dbAsync.findById('students', id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // 如果标记为最佳成绩，取消该类型其他最佳标记
    if (is_best_score) {
      const existing = await dbAsync.findAll('language_scores', { student_id: id, test_type, is_best_score: 1 });
      for (const e of existing) {
        await dbAsync.update('language_scores', e.id, { is_best_score: 0 });
      }
    }

    const score = {
      id: uuidv4(),
      student_id: id,
      test_type,
      overall_score,
      listening_score: listening_score || null,
      reading_score: reading_score || null,
      writing_score: writing_score || null,
      speaking_score: speaking_score || null,
      component_scores:
        component_scores == null
          ? null
          : typeof component_scores === 'string'
            ? component_scores
            : JSON.stringify(component_scores),
      test_date,
      valid_until: valid_until || null,
      is_best_score: is_best_score ? 1 : 0,
      created_at: new Date().toISOString()
    };

    await dbAsync.create('language_scores', score);
    res.status(201).json(score);
  } catch (error) {
    console.error('Add language score error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 更新语言成绩
router.put('/:id/language-scores/:scoreId', authenticateToken, canModify, async (req, res) => {
  try {
    const { id, scoreId } = req.params;
    const allowedFields = [
      'test_type',
      'overall_score',
      'listening_score',
      'reading_score',
      'writing_score',
      'speaking_score',
      'component_scores',
      'test_date',
      'valid_until',
      'is_best_score'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'is_best_score') {
          updates[field] = req.body[field] ? 1 : 0;
        } else if (field === 'component_scores') {
          updates[field] =
            req.body[field] == null
              ? null
              : typeof req.body[field] === 'string'
                ? req.body[field]
                : JSON.stringify(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // 如果标记为最佳成绩，取消该类型其他最佳标记
    if (updates.is_best_score === 1) {
      const scoreRecord = await dbAsync.findById('language_scores', scoreId);
      if (scoreRecord) {
        const existing = await dbAsync.findAll('language_scores', { student_id: id, test_type: scoreRecord.test_type, is_best_score: 1 });
        for (const e of existing) {
          if (e.id !== scoreId) {
            await dbAsync.update('language_scores', e.id, { is_best_score: 0 });
          }
        }
      }
    }

    const updated = await dbAsync.update('language_scores', scoreId, updates);
    if (!updated) return res.status(404).json({ error: 'Score not found' });
    res.json(updated);
  } catch (error) {
    console.error('Update language score error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 删除语言成绩
router.delete('/:id/language-scores/:scoreId', authenticateToken, canModify, async (req, res) => {
  try {
    const { scoreId } = req.params;
    const deleted = await dbAsync.delete('language_scores', scoreId);
    if (!deleted) return res.status(404).json({ error: 'Score not found' });
    res.json({ message: 'Language score deleted' });
  } catch (error) {
    console.error('Delete language score error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// === 任务 CRUD ===

// 获取学生任务列表
router.get('/:id/tasks', authenticateToken, assertOwnStudentParam('id'), async (req, res) => {
  try {
    const tasks = await dbAsync.findAll('tasks', { student_id: req.params.id });
    tasks.sort((a, b) => {
      const p = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (p[a.priority] ?? 4) - (p[b.priority] ?? 4);
    });
    // 附带 assigned_by 名称
    for (const t of tasks) {
      if (t.assigned_by) {
        const u = await dbAsync.findById('users', t.assigned_by);
        t.assigned_by_name = u ? u.name : null;
      }
    }
    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 创建任务
router.post('/:id/tasks', authenticateToken, canModify, async (req, res) => {
  try {
    const { title, description, category, priority, deadline } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const student = await dbAsync.findById('students', req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const task = {
      id: uuidv4(),
      student_id: req.params.id,
      title,
      description: description || '',
      category: category || 'academic',
      priority: priority || 'medium',
      deadline: deadline || null,
      status: 'pending',
      assigned_by: req.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await dbAsync.create('tasks', task);
    task.assigned_by_name = req.user.name;
    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 更新任务
router.put('/:id/tasks/:taskId', authenticateToken, canModify, async (req, res) => {
  try {
    const allowed = ['title', 'description', 'category', 'priority', 'deadline', 'status'];
    const updates = {};
    for (const f of allowed) { if (req.body[f] !== undefined) updates[f] = req.body[f]; }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields' });
    updates.updated_at = new Date().toISOString();

    const updated = await dbAsync.update('tasks', req.params.taskId, updates);
    if (!updated) return res.status(404).json({ error: 'Task not found' });
    res.json(updated);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 删除任务
router.delete('/:id/tasks/:taskId', authenticateToken, canModify, async (req, res) => {
  try {
    const deleted = await dbAsync.delete('tasks', req.params.taskId);
    if (!deleted) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 辅助函数：获取学生统计
async function getStudentStats(studentId) {
  const stats = {
    courseCount: 0,
    avgInternalScore: 0,
    hasLanguageScore: false,
    bestIelts: null,
    universityCount: 0,
    offerCount: 0,
    pendingTasks: 0
  };

  try {
    // 课程统计
    const courses = await dbAsync.findAll('student_courses', { student_id: studentId });
    stats.courseCount = courses.length;
    
    const scores = courses.map(c => c.internal_score).filter(Boolean);
    stats.avgInternalScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // 语言成绩
    const langScores = await dbAsync.findAll('language_scores', { student_id: studentId, is_best_score: 1 });
    stats.hasLanguageScore = langScores.length > 0;
    stats.bestIelts = langScores[0]?.overall_score;

    // 大学申请
    const unis = await dbAsync.findAll('student_universities', { student_id: studentId });
    stats.universityCount = unis.length;
    stats.offerCount = unis.filter(u => u.status === 'offer').length;

    // 待办任务
    const tasks = await dbAsync.findAll('tasks', { student_id: studentId });
    stats.pendingTasks = tasks.filter(t => ['pending', 'in_progress'].includes(t.status)).length;

  } catch (err) {
    console.error('Error getting student stats:', err);
  }

  return stats;
}

module.exports = router;

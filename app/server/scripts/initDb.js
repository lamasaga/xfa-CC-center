const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { dbAsync, initDb } = require('../db');

async function seedData() {
  const adminId = uuidv4();
  const editorId = uuidv4();
  const viewerId = uuidv4();
  const advisorId = uuidv4();
  
  // 密码加密
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const editorPassword = bcrypt.hashSync('editor123', 10);
  const viewerPassword = bcrypt.hashSync('viewer123', 10);

  // 创建用户
  await dbAsync.create('users', {
    id: adminId,
    username: 'admin',
    password: adminPassword,
    name: '系统管理员',
    email: 'admin@school.com',
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  await dbAsync.create('users', {
    id: editorId,
    username: 'editor',
    password: editorPassword,
    name: '李老师',
    email: 'li@school.com',
    role: 'editor',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  await dbAsync.create('users', {
    id: viewerId,
    username: 'viewer',
    password: viewerPassword,
    name: '张老师',
    email: 'zhang@school.com',
    role: 'viewer',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  await dbAsync.create('users', {
    id: advisorId,
    username: 'advisor',
    password: editorPassword,
    name: '王顾问',
    email: 'wang@school.com',
    role: 'editor',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  console.log('Users created');

  // 创建学生
  const studentId = uuidv4();
  await dbAsync.create('students', {
    id: studentId,
    name: '张同学',
    english_name: 'Michael Zhang',
    grade: 'A2',
    school: '上海某国际学校',
    enrollment_year: 2023,
    advisor_id: advisorId,
    phone: '138****8888',
    email: 'michael.zhang@example.com',
    wechat: 'michael_zhang',
    parent_name: '张先生',
    parent_phone: '139****9999',
    parent_email: '',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  console.log('Student created');

  // 创建课程
  const courses = [
    { id: uuidv4(), name: 'Mathematics', subject_code: 'Math', board: 'Edexcel', grade_level: 'A2' },
    { id: uuidv4(), name: 'Physics', subject_code: 'Phys', board: 'CIE', grade_level: 'A2' },
    { id: uuidv4(), name: 'Chemistry', subject_code: 'Chem', board: 'CIE', grade_level: 'A2' },
    { id: uuidv4(), name: 'Economics', subject_code: 'Econ', board: 'Edexcel', grade_level: 'A2' },
  ];

  for (const course of courses) {
    await dbAsync.create('courses', {
      ...course,
      teacher_id: editorId,
      academic_year: '2024-2025',
      semester: 'Fall',
      max_students: 20,
      description: '',
      created_at: new Date().toISOString()
    });
  }

  console.log('Courses created');

  // 注册学生到课程
  const studentCourses = [
    { id: uuidv4(), course_id: courses[0].id, grade: 'A', score: 88 },
    { id: uuidv4(), course_id: courses[1].id, grade: 'A', score: 90 },
    { id: uuidv4(), course_id: courses[2].id, grade: 'B', score: 82 },
    { id: uuidv4(), course_id: courses[3].id, grade: 'A', score: 85 },
  ];

  for (const sc of studentCourses) {
    await dbAsync.create('student_courses', {
      ...sc,
      student_id: studentId,
      internal_grade: sc.grade,
      internal_score: sc.score,
      status: 'enrolled',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  console.log('Student courses created');

  // 创建目标院校
  const universities = [
    { id: uuidv4(), name: 'University of Cambridge', country: 'UK', ranking: 2, course_name: 'Mathematics', a_level_requirement: 'A*A*A', language_requirement: 'IELTS 7.5 (7.0)', application_deadline: '2024-10-15' },
    { id: uuidv4(), name: 'Imperial College London', country: 'UK', ranking: 6, course_name: 'Mathematics with Statistics', a_level_requirement: 'A*A*A', language_requirement: 'IELTS 7.0 (6.5)', application_deadline: '2025-01-29' },
    { id: uuidv4(), name: 'University of Warwick', country: 'UK', ranking: 10, course_name: 'Mathematics and Statistics', a_level_requirement: 'A*AA', language_requirement: 'IELTS 6.5 (6.0)', application_deadline: '2025-01-29' },
    { id: uuidv4(), name: 'University of Manchester', country: 'UK', ranking: 28, course_name: 'Mathematics', a_level_requirement: 'AAA', language_requirement: 'IELTS 6.5 (6.0)', application_deadline: '2025-01-29' },
  ];

  for (const uni of universities) {
    await dbAsync.create('target_universities', {
      ...uni,
      subject_requirements: '[]',
      notes: '',
      created_at: new Date().toISOString()
    });
  }

  console.log('Universities created');

  // 关联学生到目标院校
  await dbAsync.create('student_universities', {
    id: uuidv4(),
    student_id: studentId,
    university_id: universities[0].id,
    application_type: 'reach',
    status: 'preparing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  await dbAsync.create('student_universities', {
    id: uuidv4(),
    student_id: studentId,
    university_id: universities[1].id,
    application_type: 'target',
    status: 'preparing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  await dbAsync.create('student_universities', {
    id: uuidv4(),
    student_id: studentId,
    university_id: universities[2].id,
    application_type: 'target',
    status: 'interested',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  await dbAsync.create('student_universities', {
    id: uuidv4(),
    student_id: studentId,
    university_id: universities[3].id,
    application_type: 'safety',
    status: 'interested',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  console.log('Student universities created');

  // 插入语言成绩
  await dbAsync.create('language_scores', {
    id: uuidv4(),
    student_id: studentId,
    test_type: 'IELTS',
    overall_score: 7.0,
    listening_score: 7.5,
    reading_score: 7.0,
    writing_score: 6.5,
    speaking_score: 7.0,
    test_date: '2024-08-15',
    valid_until: '2026-08-15',
    is_best_score: 1,
    created_at: new Date().toISOString()
  });

  console.log('Language score created');

  // 插入标化考试成绩
  await dbAsync.create('standardized_tests', {
    id: uuidv4(),
    student_id: studentId,
    test_type: 'SAT',
    score: 1450,
    max_score: 1600,
    section_scores: JSON.stringify({ reading: 720, math: 730 }),
    test_date: '2024-10-05',
    is_best_score: 1,
    created_at: new Date().toISOString()
  });

  console.log('Standardized test created');

  // 插入任务
  await dbAsync.create('tasks', {
    id: uuidv4(),
    student_id: studentId,
    title: 'S1补考冲刺',
    description: '重点复习概率分布和假设检验',
    category: 'academic',
    priority: 'urgent',
    deadline: '2025-01-10',
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  await dbAsync.create('tasks', {
    id: uuidv4(),
    student_id: studentId,
    title: '化学AS补考准备',
    description: '强化有机化学反应机理',
    category: 'academic',
    priority: 'urgent',
    deadline: '2025-01-15',
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  await dbAsync.create('tasks', {
    id: uuidv4(),
    student_id: studentId,
    title: 'STEP考试准备',
    description: '开始STEP II真题练习',
    category: 'standardized',
    priority: 'high',
    deadline: '2025-03-01',
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  console.log('Tasks created');

  // 插入课外活动
  await dbAsync.create('extracurriculars', {
    id: uuidv4(),
    student_id: studentId,
    name: '数学建模社团',
    activity_type: 'academic',
    role: '社长',
    organization: '校内社团',
    start_date: '2023-09',
    ongoing: 1,
    description: '组织每周数学建模讨论，带领团队参加HiMCM比赛',
    hours_per_week: 4,
    achievements: JSON.stringify(['HiMCM 2024 Meritorious Award', '组织5场校内讲座']),
    created_at: new Date().toISOString()
  });

  console.log('Extracurricular created');

  console.log('\n=== Test Accounts ===');
  console.log('Admin:  admin / admin123');
  console.log('Editor: editor / editor123');
  console.log('Viewer: viewer / viewer123');
  console.log('=====================\n');
}

// 执行
(async () => {
  try {
    await initDb();
    await seedData();
    console.log('Database initialization completed!');
  } catch (err) {
    console.error('Database initialization failed:', err);
    process.exit(1);
  }
})();

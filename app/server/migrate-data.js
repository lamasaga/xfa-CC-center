const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '../database.sqlite');
const JSON_PATH = path.join(__dirname, '../database.json');

async function migrateData() {
  console.log('Migrating data from JSON to SQLite...\n');
  
  // 检查 JSON 文件是否存在
  if (!fs.existsSync(JSON_PATH)) {
    console.error('❌ database.json not found:', JSON_PATH);
    console.log('No data to migrate. Skipping...');
    process.exit(0);
  }
  
  // 读取 JSON 数据
  let jsonData;
  try {
    const content = fs.readFileSync(JSON_PATH, 'utf8');
    jsonData = JSON.parse(content);
    console.log('✓ Loaded database.json');
  } catch (error) {
    console.error('❌ Failed to parse database.json:', error.message);
    process.exit(1);
  }
  
  // 连接 SQLite 数据库
  const db = new Database(DB_PATH);
  
  // 准备插入语句
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password, name, email, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertStudent = db.prepare(`
    INSERT INTO students (id, name, english_name, grade, school, enrollment_year, advisor_id, 
      phone, email, wechat, parent_name, parent_phone, parent_email, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertCourse = db.prepare(`
    INSERT INTO courses (id, name, subject_code, board, grade_level, teacher_id, 
      academic_year, semester, max_students, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertStudentCourse = db.prepare(`
    INSERT INTO student_courses (id, student_id, course_id, internal_grade, internal_score,
      mock_grade, mock_score, final_grade, final_score, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertTargetUniversity = db.prepare(`
    INSERT INTO target_universities (id, name, country, ranking, course_name, a_level_requirement,
      language_requirement, subject_requirements, application_deadline, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertStudentUniversity = db.prepare(`
    INSERT INTO student_universities (id, student_id, university_id, application_type, status,
      created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertLanguageScore = db.prepare(`
    INSERT INTO language_scores (id, student_id, test_type, overall_score, listening_score,
      reading_score, writing_score, speaking_score, test_date, valid_until, is_best_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertStandardizedTest = db.prepare(`
    INSERT INTO standardized_tests (id, student_id, test_type, score, max_score, section_scores,
      test_date, is_best_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertExtracurricular = db.prepare(`
    INSERT INTO extracurriculars (id, student_id, name, activity_type, role, organization,
      start_date, ongoing, description, hours_per_week, achievements, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, student_id, title, description, category, priority, deadline,
      status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  try {
    // 开始事务
    const migrate = db.transaction(() => {
      let migrated = 0;
      
      // 迁移用户
      if (jsonData.users) {
        for (const user of jsonData.users) {
          insertUser.run(
            user.id,
            user.username,
            user.password,
            user.name,
            user.email || null,
            user.role,
            user.created_at,
            user.updated_at
          );
        }
        console.log(`✓ Migrated ${jsonData.users.length} users`);
        migrated += jsonData.users.length;
      }
      
      // 迁移学生
      if (jsonData.students) {
        for (const student of jsonData.students) {
          const gradeMap = { 'AS': '2025级', 'A2': '2024级', 'IG': '2026级' };
          const mappedGrade = gradeMap[student.grade] || student.grade;
          insertStudent.run(
            student.id,
            student.name,
            student.english_name || null,
            mappedGrade,
            student.school || null,
            student.enrollment_year || null,
            student.advisor_id || null,
            student.phone || null,
            student.email || null,
            student.wechat || null,
            student.parent_name || null,
            student.parent_phone || null,
            student.parent_email || null,
            student.status || 'active',
            student.created_at,
            student.updated_at
          );
        }
        console.log(`✓ Migrated ${jsonData.students.length} students`);
        migrated += jsonData.students.length;
      }
      
      // 迁移课程
      if (jsonData.courses) {
        for (const course of jsonData.courses) {
          insertCourse.run(
            course.id,
            course.name,
            course.subject_code || null,
            course.board,
            course.grade_level,
            course.teacher_id || null,
            course.academic_year || null,
            course.semester || null,
            course.max_students || 20,
            course.description || null,
            course.created_at
          );
        }
        console.log(`✓ Migrated ${jsonData.courses.length} courses`);
        migrated += jsonData.courses.length;
      }
      
      // 迁移学生选课
      if (jsonData.student_courses) {
        for (const sc of jsonData.student_courses) {
          insertStudentCourse.run(
            sc.id,
            sc.student_id,
            sc.course_id,
            sc.internal_grade || sc.grade || null,
            sc.internal_score || sc.score || null,
            sc.mock_grade || null,
            sc.mock_score || null,
            sc.final_grade || null,
            sc.final_score || null,
            sc.status || 'enrolled',
            sc.created_at,
            sc.updated_at
          );
        }
        console.log(`✓ Migrated ${jsonData.student_courses.length} student_courses`);
        migrated += jsonData.student_courses.length;
      }
      
      // 迁移目标院校
      if (jsonData.target_universities) {
        for (const uni of jsonData.target_universities) {
          insertTargetUniversity.run(
            uni.id,
            uni.name,
            uni.country,
            uni.ranking || null,
            uni.course_name || null,
            uni.a_level_requirement || null,
            uni.language_requirement || null,
            uni.subject_requirements || null,
            uni.application_deadline || null,
            uni.notes || null,
            uni.created_at
          );
        }
        console.log(`✓ Migrated ${jsonData.target_universities.length} target_universities`);
        migrated += jsonData.target_universities.length;
      }
      
      // 迁移学生目标院校
      if (jsonData.student_universities) {
        for (const su of jsonData.student_universities) {
          insertStudentUniversity.run(
            su.id,
            su.student_id,
            su.university_id,
            su.application_type || null,
            (su.status === 'preparing' ? 'interested' : su.status) || 'interested',
            su.created_at,
            su.updated_at
          );
        }
        console.log(`✓ Migrated ${jsonData.student_universities.length} student_universities`);
        migrated += jsonData.student_universities.length;
      }
      
      // 迁移语言成绩
      if (jsonData.language_scores) {
        for (const ls of jsonData.language_scores) {
          insertLanguageScore.run(
            ls.id,
            ls.student_id,
            ls.test_type,
            ls.overall_score,
            ls.listening_score || null,
            ls.reading_score || null,
            ls.writing_score || null,
            ls.speaking_score || null,
            ls.test_date,
            ls.valid_until || null,
            ls.is_best_score ? 1 : 0,
            ls.created_at
          );
        }
        console.log(`✓ Migrated ${jsonData.language_scores.length} language_scores`);
        migrated += jsonData.language_scores.length;
      }
      
      // 迁移标化考试
      if (jsonData.standardized_tests) {
        for (const st of jsonData.standardized_tests) {
          insertStandardizedTest.run(
            st.id,
            st.student_id,
            st.test_type,
            st.score,
            st.max_score || null,
            st.section_scores ? JSON.stringify(st.section_scores) : null,
            st.test_date,
            st.is_best_score ? 1 : 0,
            st.created_at
          );
        }
        console.log(`✓ Migrated ${jsonData.standardized_tests.length} standardized_tests`);
        migrated += jsonData.standardized_tests.length;
      }
      
      // 迁移课外活动
      if (jsonData.extracurriculars) {
        for (const ex of jsonData.extracurriculars) {
          insertExtracurricular.run(
            ex.id,
            ex.student_id,
            ex.name,
            ex.activity_type || null,
            ex.role || null,
            ex.organization || null,
            ex.start_date || null,
            ex.ongoing ? 1 : 0,
            ex.description || null,
            ex.hours_per_week || null,
            ex.achievements ? JSON.stringify(ex.achievements) : null,
            ex.created_at
          );
        }
        console.log(`✓ Migrated ${jsonData.extracurriculars.length} extracurriculars`);
        migrated += jsonData.extracurriculars.length;
      }
      
      // 迁移任务
      if (jsonData.tasks) {
        for (const task of jsonData.tasks) {
          insertTask.run(
            task.id,
            task.student_id,
            task.title,
            task.description || null,
            task.category || null,
            task.priority || null,
            task.deadline || null,
            task.status || 'pending',
            task.created_at,
            task.updated_at
          );
        }
        console.log(`✓ Migrated ${jsonData.tasks.length} tasks`);
        migrated += jsonData.tasks.length;
      }
      
      return migrated;
    });
    
    const totalMigrated = migrate();
    
    console.log('\n✅ Migration completed successfully!');
    console.log(`Total records migrated: ${totalMigrated}`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    db.close();
    process.exit(1);
  }
  
  db.close();
}

migrateData();

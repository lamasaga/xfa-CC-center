const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db');
const {
  authenticateToken,
  canModify,
  canManageUniversityCatalog,
} = require('../middleware/auth');
const {
  normalizeCountry,
  normalizeDate,
  normalizeLanguageRequirement,
  normalizeUniversityRow: normalizeUniversityData,
  normalizeProgramRow: normalizeProgramData,
  dedupePrograms,
} = require('../utils/universityData');

const router = express.Router();

function safeJsonParse(s, fallback = null) {
  if (!s || typeof s !== 'string') return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

function normalizeSubjectRequirements(v) {
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  if (v == null) return [];
  if (typeof v !== 'string') return [];
  const trimmed = v.trim();
  if (!trimmed) return [];
  const parsed = safeJsonParse(trimmed, null);
  if (Array.isArray(parsed)) return parsed.map(String).map(s => s.trim()).filter(Boolean);
  // fallback: split by newline/comma/semicolon
  return trimmed
    .split(/[\n,;，；]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatUniversityRow(u, sensitiveNames = []) {
  const normalized = normalizeUniversityData(u, sensitiveNames);
  return {
    ...normalized,
    subject_requirements: normalizeSubjectRequirements(normalized.subject_requirements),
    application_systems: safeJsonParse(normalized.application_systems, null),
    rounds_supported: safeJsonParse(normalized.rounds_supported, null),
    costs: safeJsonParse(normalized.costs, null),
    requirements_struct: safeJsonParse(normalized.requirements_struct, null),
  };
}

function formatProgramRow(p, sensitiveNames = []) {
  const normalized = normalizeProgramData(p, sensitiveNames);
  return {
    ...normalized,
    requirements_struct: safeJsonParse(normalized.requirements_struct, null),
    alevel_required_grades: safeJsonParse(normalized.alevel_required_grades, null),
    subject_requirements_struct: safeJsonParse(normalized.subject_requirements_struct, null),
    extra_exams: safeJsonParse(normalized.extra_exams, null),
    language_component_mins: safeJsonParse(normalized.language_component_mins, null),
  };
}

async function getSensitiveNames() {
  const students = await dbAsync.findAll('students');
  return students.flatMap((student) => [student.name, student.english_name]);
}

// 获取所有目标院校
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { country, search } = req.query;
    let universities = await dbAsync.findAll('target_universities');
    const sensitiveNames = await getSensitiveNames();
    const normalizedCountry = country ? normalizeCountry(country) : null;
    
    if (country && !normalizedCountry) {
      return res.status(400).json({ error: '国家/地区不在支持范围内' });
    }
    if (normalizedCountry) {
      universities = universities.filter(u => normalizeCountry(u.country) === normalizedCountry);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      universities = universities.filter(u =>
        String(u.name || '').toLowerCase().includes(searchLower) ||
        String(u.course_name || '').toLowerCase().includes(searchLower)
      );
    }
    
    res.json(universities.map((u) => formatUniversityRow(u, sensitiveNames)));
  } catch (error) {
    console.error('Get universities error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 获取单个院校
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const uni = await dbAsync.findById('target_universities', req.params.id);
    if (!uni) return res.status(404).json({ error: 'Not found' });
    res.json(formatUniversityRow(uni, await getSensitiveNames()));
  } catch (error) {
    console.error('Get university error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 创建目标院校
router.post('/', authenticateToken, canManageUniversityCatalog, async (req, res) => {
  try {
    const {
      name, country, ranking, course_name,
      a_level_requirement, language_requirement, subject_requirements,
      degree_level, edu_system,
      school_type, admit_rate, application_systems, rounds_supported, costs, location_text, campus_size_text,
      requirements_struct,
      application_deadline, notes,
    } = req.body;
    
    const normalizedCountry = normalizeCountry(country);
    if (!name || !normalizedCountry) {
      return res.status(400).json({ error: 'Name and country required' });
    }

    const university = {
      id: uuidv4(),
      name,
      country: normalizedCountry,
      ranking: ranking || null,
      course_name: course_name || '',
      a_level_requirement: a_level_requirement || '',
      language_requirement: normalizeLanguageRequirement(language_requirement),
      subject_requirements: Array.isArray(subject_requirements) ? JSON.stringify(subject_requirements) : (subject_requirements || ''),
      degree_level: degree_level || null,
      edu_system: edu_system || null,
      school_type: school_type || null,
      admit_rate: typeof admit_rate === 'number' ? admit_rate : (admit_rate ? parseFloat(String(admit_rate)) : null),
      application_systems: Array.isArray(application_systems) ? JSON.stringify(application_systems) : (application_systems ? JSON.stringify(application_systems) : null),
      rounds_supported: Array.isArray(rounds_supported) ? JSON.stringify(rounds_supported) : (rounds_supported ? JSON.stringify(rounds_supported) : null),
      costs: costs ? JSON.stringify(costs) : null,
      location_text: location_text || null,
      campus_size_text: campus_size_text || null,
      requirements_struct: requirements_struct ? JSON.stringify(requirements_struct) : null,
      application_deadline: normalizeDate(application_deadline),
      notes: notes || '',
      created_at: new Date().toISOString()
    };

    await dbAsync.create('target_universities', university);
    res.status(201).json(formatUniversityRow(university, await getSensitiveNames()));
  } catch (error) {
    console.error('Create university error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 更新目标院校
router.put('/:id', authenticateToken, canManageUniversityCatalog, async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'name', 'country', 'ranking', 'course_name',
      'a_level_requirement', 'language_requirement', 'subject_requirements',
      'degree_level', 'edu_system',
      'school_type', 'admit_rate', 'application_systems', 'rounds_supported', 'costs', 'location_text', 'campus_size_text',
      'requirements_struct',
      'application_deadline', 'notes',
    ];
    
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'country') {
          const normalizedCountry = normalizeCountry(req.body[field]);
          if (!normalizedCountry) return res.status(400).json({ error: '国家/地区不在支持范围内' });
          updates[field] = normalizedCountry;
        } else if (field === 'language_requirement') {
          updates[field] = normalizeLanguageRequirement(req.body[field]);
        } else if (field === 'application_deadline') {
          updates[field] = normalizeDate(req.body[field]);
        } else if (field === 'subject_requirements') {
          updates[field] = Array.isArray(req.body[field]) ? JSON.stringify(req.body[field]) : req.body[field];
        } else if (field === 'application_systems' || field === 'rounds_supported') {
          updates[field] = Array.isArray(req.body[field]) ? JSON.stringify(req.body[field]) : (req.body[field] ? JSON.stringify(req.body[field]) : null);
        } else if (field === 'costs' || field === 'requirements_struct') {
          updates[field] = req.body[field] ? JSON.stringify(req.body[field]) : null;
        } else if (field === 'admit_rate') {
          updates[field] = typeof req.body[field] === 'number' ? req.body[field] : (req.body[field] ? parseFloat(String(req.body[field])) : null);
        } else {
          updates[field] = req.body[field];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const university = await dbAsync.update('target_universities', id, updates);
    if (!university) {
      return res.status(404).json({ error: 'University not found' });
    }

    res.json(formatUniversityRow(university, await getSensitiveNames()));
  } catch (error) {
    console.error('Update university error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 删除目标院校
router.delete('/:id', authenticateToken, canManageUniversityCatalog, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await dbAsync.delete('target_universities', id);
    if (!deleted) {
      return res.status(404).json({ error: 'University not found' });
    }
    res.json({ message: 'University deleted successfully' });
  } catch (error) {
    console.error('Delete university error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// === 院校专业管理 ===

// 获取院校的专业列表
router.get('/:id/programs', authenticateToken, async (req, res) => {
  try {
    const programs = await dbAsync.findAll('university_programs', { university_id: req.params.id });
    const sensitiveNames = await getSensitiveNames();
    res.json(dedupePrograms(programs.map((p) => formatProgramRow(p, sensitiveNames))));
  } catch (error) {
    console.error('Get programs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 添加专业
router.post('/:id/programs', authenticateToken, canManageUniversityCatalog, async (req, res) => {
  try {
    const {
      program_name, department,
      a_level_requirement, language_requirement, subject_requirements,
      // structured (optional)
      requirements_struct,
      alevel_required_grades,
      subject_requirements_struct,
      extra_exams,
      language_type,
      language_overall_min,
      language_component_mins,
      us_major_selectivity,
      us_prerequisites_text,
      portfolio_required,
      portfolio_notes,
      application_deadline, tuition_fee, duration, notes
    } = req.body;
    if (!program_name) return res.status(400).json({ error: 'program_name required' });

    const uni = await dbAsync.findById('target_universities', req.params.id);
    if (!uni) return res.status(404).json({ error: 'University not found' });

    const program = {
      id: uuidv4(),
      university_id: req.params.id,
      program_name, department: department || '',
      a_level_requirement: a_level_requirement || '',
      language_requirement: normalizeLanguageRequirement(language_requirement),
      subject_requirements: subject_requirements || '',
      requirements_struct: requirements_struct ? JSON.stringify(requirements_struct) : null,
      alevel_required_grades: Array.isArray(alevel_required_grades) ? JSON.stringify(alevel_required_grades) : null,
      subject_requirements_struct: subject_requirements_struct ? JSON.stringify(subject_requirements_struct) : null,
      extra_exams: Array.isArray(extra_exams) ? JSON.stringify(extra_exams) : null,
      language_type: language_type || null,
      language_overall_min: typeof language_overall_min === 'number' ? language_overall_min : null,
      language_component_mins: language_component_mins ? JSON.stringify(language_component_mins) : null,
      us_major_selectivity: us_major_selectivity || null,
      us_prerequisites_text: us_prerequisites_text || null,
      portfolio_required: portfolio_required ? 1 : 0,
      portfolio_notes: portfolio_notes || null,
      application_deadline: normalizeDate(application_deadline),
      tuition_fee: tuition_fee || '',
      duration: duration || '',
      notes: notes || '',
      created_at: new Date().toISOString(),
    };
    await dbAsync.create('university_programs', program);
    res.status(201).json(formatProgramRow(program, await getSensitiveNames()));
  } catch (error) {
    console.error('Add program error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 更新专业
router.put('/:id/programs/:programId', authenticateToken, canManageUniversityCatalog, async (req, res) => {
  try {
    const allowed = [
      'program_name', 'department',
      'a_level_requirement', 'language_requirement', 'subject_requirements',
      'application_deadline', 'tuition_fee', 'duration', 'notes',
      // structured
      'requirements_struct',
      'alevel_required_grades',
      'subject_requirements_struct',
      'extra_exams',
      'language_type',
      'language_overall_min',
      'language_component_mins',
      // us
      'us_major_selectivity',
      'us_prerequisites_text',
      'portfolio_required',
      'portfolio_notes',
    ];
    const updates = {};
    for (const f of allowed) {
      if (req.body[f] === undefined) continue;
      if (f === 'requirements_struct') updates[f] = req.body[f] ? JSON.stringify(req.body[f]) : null;
      else if (f === 'alevel_required_grades') updates[f] = Array.isArray(req.body[f]) ? JSON.stringify(req.body[f]) : null;
      else if (f === 'extra_exams') updates[f] = Array.isArray(req.body[f]) ? JSON.stringify(req.body[f]) : null;
      else if (f === 'subject_requirements_struct') updates[f] = req.body[f] ? JSON.stringify(req.body[f]) : null;
      else if (f === 'language_component_mins') updates[f] = req.body[f] ? JSON.stringify(req.body[f]) : null;
      else if (f === 'portfolio_required') updates[f] = req.body[f] ? 1 : 0;
      else if (f === 'language_requirement') updates[f] = normalizeLanguageRequirement(req.body[f]);
      else if (f === 'application_deadline') updates[f] = normalizeDate(req.body[f]);
      else updates[f] = req.body[f];
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields' });

    const updated = await dbAsync.update('university_programs', req.params.programId, updates);
    if (!updated) return res.status(404).json({ error: 'Program not found' });
    res.json(formatProgramRow(updated, await getSensitiveNames()));
  } catch (error) {
    console.error('Update program error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 删除专业
router.delete('/:id/programs/:programId', authenticateToken, canManageUniversityCatalog, async (req, res) => {
  try {
    const deleted = await dbAsync.delete('university_programs', req.params.programId);
    if (!deleted) return res.status(404).json({ error: 'Program not found' });
    res.json({ message: 'Program deleted' });
  } catch (error) {
    console.error('Delete program error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 添加学生目标院校关联
router.post('/student/:studentId', authenticateToken, canModify, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { university_id, application_type } = req.body;

    if (!university_id) {
      return res.status(400).json({ error: 'university_id required' });
    }

    // 检查是否已存在
    const existing = await dbAsync.findAll('student_universities', { student_id: studentId, university_id });
    if (existing.length > 0) {
      return res.status(400).json({ error: 'University already added to student' });
    }

    const studentUni = {
      id: uuidv4(),
      student_id: studentId,
      university_id,
      program_id: req.body.program_id || null,
      application_type: application_type || 'target',
      status: 'interested',
      personal_statement_status: '',
      reference_status: '',
      submitted_at: null,
      decision_date: null,
      conditions: '',
      notes: '',
      matching_prefs: null,
      offer_detail: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await dbAsync.create('student_universities', studentUni);
    
    // 返回完整的院校信息
    const uni = await dbAsync.findById('target_universities', university_id);
    res.status(201).json({ ...studentUni, ...uni });
  } catch (error) {
    console.error('Add student university error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 更新学生目标院校状态
router.put('/student/:studentId/:universityId', authenticateToken, canModify, async (req, res) => {
  try {
    const { studentId, universityId } = req.params;
    const {
      application_type,
      status,
      personal_statement_status,
      reference_status,
      submitted_at,
      decision_date,
      conditions,
      notes,
      program_id,
      matching_prefs,
      offer_detail,
    } = req.body;

    // 查找记录
    const records = await dbAsync.findAll('student_universities', { student_id: studentId, university_id: universityId });
    if (records.length === 0) {
      return res.status(404).json({ error: 'Student university record not found' });
    }

    const recordId = records[0].id;
    const updates = {
      ...(application_type !== undefined && { application_type }),
      ...(status !== undefined && { status }),
      ...(personal_statement_status !== undefined && { personal_statement_status }),
      ...(reference_status !== undefined && { reference_status }),
      ...(submitted_at !== undefined && { submitted_at }),
      ...(decision_date !== undefined && { decision_date }),
      ...(conditions !== undefined && { conditions }),
      ...(notes !== undefined && { notes }),
      ...(program_id !== undefined && { program_id: program_id || null }),
      ...(matching_prefs !== undefined && {
        matching_prefs: typeof matching_prefs === 'string' ? matching_prefs : JSON.stringify(matching_prefs ?? {}),
      }),
      ...(offer_detail !== undefined && {
        offer_detail: typeof offer_detail === 'string' ? offer_detail : JSON.stringify(offer_detail ?? {}),
      }),
      updated_at: new Date().toISOString()
    };

    const updated = await dbAsync.update('student_universities', recordId, updates);
    res.json(updated);
  } catch (error) {
    console.error('Update student university error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 删除学生目标院校关联
router.delete('/student/:studentId/:universityId', authenticateToken, canModify, async (req, res) => {
  try {
    const { studentId, universityId } = req.params;
    
    const records = await dbAsync.findAll('student_universities', { student_id: studentId, university_id: universityId });
    if (records.length === 0) {
      return res.status(404).json({ error: 'Student university record not found' });
    }

    await dbAsync.delete('student_universities', records[0].id);
    res.json({ message: 'Student university removed successfully' });
  } catch (error) {
    console.error('Remove student university error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

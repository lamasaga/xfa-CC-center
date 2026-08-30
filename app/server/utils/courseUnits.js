function normalizedUnitKey(value) {
  return String(value || '').trim().toLowerCase();
}

function unitMatchesRecord(unit, record) {
  const unitCode = normalizedUnitKey(unit.unit_code);
  const recordCode = normalizedUnitKey(record.unit_code);
  if (unitCode && recordCode) return unitCode === recordCode;
  return normalizedUnitKey(unit.unit_name) !== '' &&
    normalizedUnitKey(unit.unit_name) === normalizedUnitKey(record.unit_name);
}

const FLEXIBLE_UNIT_RULES = {
  'IAL-MATH': {
    totalUnits: 6,
    coreUnitCodes: ['P1', 'P2', 'P3', 'P4'],
    choiceUnitCodes: ['M1', 'S1', 'D1'],
    choiceCount: 2,
  },
  'IAL-FM': {
    totalUnits: 6,
    coreUnitCodes: ['FP1', 'FP2', 'FP3'],
    choiceUnitCodes: ['M1', 'M2', 'S1', 'S2', 'D1'],
    choiceCount: 3,
  },
  'IAL-FMATH': {
    totalUnits: 6,
    coreUnitCodes: ['FP1', 'FP2', 'FP3'],
    choiceUnitCodes: ['M1', 'M2', 'S1', 'S2', 'D1'],
    choiceCount: 3,
  },
};

function getFlexibleUnitRule(course) {
  const subjectCode = String(course?.subject_code || '').trim().toUpperCase();
  return FLEXIBLE_UNIT_RULES[subjectCode] || null;
}

function sortCourseUnits(units) {
  return [...units].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function hasSelectionEvidence(unit, unitGrades, plannedUnitIds) {
  return plannedUnitIds.has(String(unit.id)) || unitGrades.some((grade) => unitMatchesRecord(unit, grade));
}

/**
 * 数学与进阶数学的单元不是逐项“必修/可选”：
 * - Mathematics = P1-P4 + M1/S1/D1 任两门；
 * - Further Mathematics = FP1-FP3 + M1/M2/S1/S2/D1 任三门。
 *
 * 已录入成绩或已安排考季的选修单元，优先认定为该学生实际选考组合；
 * 未选满时只补足预测所需的空位，不会把未选候选单元计为已完成。
 */
function getStudentUnitSelection(course, courseUnits = [], unitGrades = [], plans = []) {
  const rule = getFlexibleUnitRule(course);
  const sortedUnits = sortCourseUnits(courseUnits);
  const gradeEvidence = unitGrades.filter((grade) => grade && grade.exam_type);
  const plannedUnitIds = new Set(
    plans
      .filter((plan) => plan && plan.status !== 'cancelled')
      .map((plan) => String(plan.course_unit_id))
  );

  if (!rule) {
    const activeUnits = sortedUnits.filter((unit) => {
      if (unit.is_required !== 0 && unit.is_required !== false) return true;
      return hasSelectionEvidence(unit, gradeEvidence, plannedUnitIds);
    });
    return {
      rule: null,
      targetUnitCount: activeUnits.length,
      predictionUnits: activeUnits,
      planningUnits: activeUnits,
      selectedUnits: activeUnits,
    };
  }

  const byCode = new Map(sortedUnits.map((unit) => [normalizedUnitKey(unit.unit_code), unit]));
  const coreUnits = rule.coreUnitCodes.map((code) => byCode.get(normalizedUnitKey(code))).filter(Boolean);
  const choiceUnits = rule.choiceUnitCodes.map((code) => byCode.get(normalizedUnitKey(code))).filter(Boolean);
  const choiceEvidence = choiceUnits.filter((unit) => hasSelectionEvidence(unit, gradeEvidence, plannedUnitIds));
  const selectedUnits = [...coreUnits, ...choiceEvidence.filter((unit) => !coreUnits.includes(unit))];

  // 配置尚未补全时降级为已配置单元，避免凭空构造课程单元。
  if (coreUnits.length !== rule.coreUnitCodes.length || choiceUnits.length < rule.choiceCount) {
    return {
      rule,
      targetUnitCount: rule.totalUnits,
      predictionUnits: sortedUnits,
      planningUnits: sortedUnits,
      selectedUnits: sortedUnits.filter((unit) => hasSelectionEvidence(unit, gradeEvidence, plannedUnitIds)),
    };
  }

  const predictionUnits = [...selectedUnits];
  for (const unit of choiceUnits) {
    if (predictionUnits.length >= rule.totalUnits) break;
    if (!predictionUnits.includes(unit)) predictionUnits.push(unit);
  }

  return {
    rule,
    targetUnitCount: rule.totalUnits,
    predictionUnits,
    // 考季规划必须展示全部候选项，教师才能把尚未录分的任选单元加入计划。
    planningUnits: [...coreUnits, ...choiceUnits.filter((unit) => !coreUnits.includes(unit))],
    selectedUnits,
  };
}

/**
 * 兼容旧调用：预测使用按学生实际组合补足后的六个有效单元。
 */
function selectActiveCourseUnits(courseUnits, unitGrades = [], plans = [], course = null) {
  return getStudentUnitSelection(course, courseUnits, unitGrades, plans).predictionUnits;
}

module.exports = {
  normalizedUnitKey,
  unitMatchesRecord,
  getFlexibleUnitRule,
  getStudentUnitSelection,
  selectActiveCourseUnits,
};

function toFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedUnitKey(value) {
  return String(value || '').trim().toLowerCase();
}

function scoreDateKey(unitGrade) {
  return String(unitGrade?.exam_date || unitGrade?.created_at || '');
}

function percentageFor(unitGrade) {
  const score = toFiniteNumber(unitGrade?.score);
  const maxScore = toFiniteNumber(unitGrade?.max_score);
  if (score === null || maxScore === null || maxScore <= 0) return null;
  return (score / maxScore) * 100;
}

/**
 * 每个单元只保留较高的一次实考/补考；同分时保留日期较新的记录。
 * 配置了单元权重时一并带回，供年级和课程汇总使用。
 */
function selectBestActualExamUnits(unitGrades, courseUnits = []) {
  const weightByUnit = new Map();
  for (const unit of courseUnits) {
    const key = normalizedUnitKey(unit.unit_code || unit.unit_name);
    const configuredWeight = toFiniteNumber(unit.weight);
    if (key) weightByUnit.set(key, configuredWeight !== null && configuredWeight > 0 ? configuredWeight : 1);
  }

  const bestByUnit = new Map();
  unitGrades.forEach((row, index) => {
    if (row.exam_type !== 'final' && row.exam_type !== 'retake') return;
    const percentage = percentageFor(row);
    if (percentage === null) return;
    const unitKey = normalizedUnitKey(row.unit_code || row.unit_name || `__row_${index}`);
    const previous = bestByUnit.get(unitKey);
    if (
      !previous ||
      percentage > previous.percentage ||
      (percentage === previous.percentage && scoreDateKey(row) > scoreDateKey(previous.row))
    ) {
      bestByUnit.set(unitKey, {
        row,
        percentage,
        weight: weightByUnit.get(unitKey) || 1,
      });
    }
  });

  return [...bestByUnit.values()].sort((a, b) =>
    String(a.row.unit_code || a.row.unit_name || '').localeCompare(
      String(b.row.unit_code || b.row.unit_name || ''),
      undefined,
      { numeric: true }
    )
  );
}

function weightedActualExamAverage(bestUnits) {
  const totalWeight = bestUnits.reduce((sum, unit) => sum + unit.weight, 0);
  if (totalWeight <= 0) return null;
  return bestUnits.reduce((sum, unit) => sum + unit.percentage * unit.weight, 0) / totalWeight;
}

function roundOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

module.exports = {
  percentageFor,
  selectBestActualExamUnits,
  weightedActualExamAverage,
  roundOneDecimal,
};

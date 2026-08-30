function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + (x - m) * (x - m), 0) / (arr.length - 1);
  return Math.sqrt(Math.max(0, v));
}

// Box-Muller transform
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function pctToGrade(pct) {
  const p = pct * 100;
  // A* 由联合条件决定（总分>=80%且高阶>=90%），这里仅做兜底展示
  if (p >= 90) return 'A*';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B';
  if (p >= 60) return 'C';
  if (p >= 50) return 'D';
  if (p >= 40) return 'E';
  return 'U';
}

function gradeThresholdPct(grade) {
  switch (grade) {
    case 'A': return 0.8;
    case 'B': return 0.7;
    case 'C': return 0.6;
    case 'D': return 0.5;
    case 'E': return 0.4;
    default: return 0;
  }
}

function gradeFromPercentages(totalPct, advancedPct, hasAdvancedUnits) {
  if (totalPct >= 0.8 && hasAdvancedUnits && advancedPct >= 0.9) return 'A*';
  if (totalPct >= 0.8) return 'A';
  if (totalPct >= 0.7) return 'B';
  if (totalPct >= 0.6) return 'C';
  if (totalPct >= 0.5) return 'D';
  if (totalPct >= 0.4) return 'E';
  return 'U';
}

function oneHotProbabilities(grade) {
  return {
    'A*': grade === 'A*' ? 1 : 0,
    A: grade === 'A' ? 1 : 0,
    B: grade === 'B' ? 1 : 0,
    C: grade === 'C' ? 1 : 0,
    D: grade === 'D' ? 1 : 0,
    E: grade === 'E' ? 1 : 0,
    U: grade === 'U' ? 1 : 0,
  };
}

/**
 * 以“保守”的方式预测最终成绩分布。
 *
 * 直觉：
 * - 已考单元越少，不确定性越大；对“高分段”做轻微折扣（5%~10%），低分不折扣
 * - 已考单元越多，预测会逐渐逼近真实（均值下调变小、方差变小）
 * - A* 按联合条件：总分>=80% 且 高阶>=90%
 * - 在未考任何高阶单元前，A* 概率保持谨慎
 */
function predictCourseFromUnits(input) {
  const {
    course_id,
    course_name,
    board,
    student_course_id,
    units, // [{unit_code, max_score, weight, is_advanced, exam_pct|null}]
    confirmed_grade,
    confirmed_score,
    options,
  } = input;

  const cfg = {
    // 高分段折扣：只在当前已考均值>=80%时启用，折扣区间 5%~10%
    highScoreDiscountMin: 0.05,
    highScoreDiscountMax: 0.10,
    // 未考单元波动范围
    minSigma: 0.05,
    maxSigma: 0.18,
    samples: 2500,
    ...options,
  };

  const totalWeight = units.reduce((s, u) => s + (u.max_score * (u.weight || 1)), 0);
  const observed = units.filter(u => u.exam_pct != null);
  const missing = units.filter(u => u.exam_pct == null);

  const observedWeight = observed.reduce((s, u) => s + (u.max_score * (u.weight || 1)), 0);
  const coverage = totalWeight > 0 ? observedWeight / totalWeight : 0;

  const observedPcts = observed.map(u => u.exam_pct);
  const observedMean = observedWeight > 0
    ? observed.reduce((s, u) => s + u.exam_pct * u.max_score * (u.weight || 1), 0) / observedWeight
    : 0;
  const observedSd = stddev(observedPcts);

  const missingFraction = 1 - coverage;

  // 保守折扣：低于80%不折扣；高于80%按缺失程度给 5%~10%折扣（幅度不大）
  const discountRate = cfg.highScoreDiscountMin + (cfg.highScoreDiscountMax - cfg.highScoreDiscountMin) * missingFraction;
  const baseMean = observedMean >= 0.8
    ? clamp(observedMean * (1 - discountRate), 0, 1)
    : clamp(observedMean, 0, 1);

  // 方差：样本少 → 放大；样本多 → 收敛
  const countFactor = observed.length <= 1 ? 2.2 : Math.sqrt((units.length + 1) / (observed.length + 1));
  const sigma = clamp(
    (cfg.minSigma + 0.9 * observedSd) * countFactor,
    cfg.minSigma,
    cfg.maxSigma
  );

  const advUnits = units.filter(u => !!u.is_advanced);
  const advScoreMax = advUnits.reduce((s, u) => s + (u.max_score * (u.weight || 1)), 0);
  const advObserved = advUnits.filter(u => u.exam_pct != null);
  const advObservedWeight = advObserved.reduce((s, u) => s + (u.max_score * (u.weight || 1)), 0);
  const advObservedMean = advObservedWeight > 0
    ? advObserved.reduce((s, u) => s + u.exam_pct * u.max_score * (u.weight || 1), 0) / advObservedWeight
    : null;

  const normalizedConfirmedGrade = String(confirmed_grade || '').trim().toUpperCase();
  const confirmedGrades = new Set(['A*', 'A', 'B', 'C', 'D', 'E', 'U']);
  if (confirmedGrades.has(normalizedConfirmedGrade)) {
    // null / 空值表示“只有确定等级，未录课程汇总分”，不能被 Number(null) 误当作 0 分。
    const hasConfirmedScore = confirmed_score !== null && confirmed_score !== undefined && String(confirmed_score).trim() !== '';
    const numericConfirmedScore = hasConfirmedScore ? Number(confirmed_score) : null;
    const confirmedPct = numericConfirmedScore !== null && Number.isFinite(numericConfirmedScore) && numericConfirmedScore >= 0 && numericConfirmedScore <= 100
      ? numericConfirmedScore / 100
      : null;
    const displayPct = confirmedPct ?? (observedWeight > 0 ? observedMean : null);

    return {
      course_id,
      course_name,
      board,
      student_course_id,
      coverage: Math.round(coverage * 1000) / 1000,
      confidence: 1,
      observed_units: observed.length,
      total_units: units.length,
      predicted_pct: displayPct != null ? Math.round(displayPct * 1000) / 10 : null,
      predicted_total_score: displayPct != null ? Math.round(displayPct * totalWeight) : null,
      max_total_score: Math.round(totalWeight),
      predicted_advanced_pct: advObservedMean != null ? Math.round(advObservedMean * 1000) / 10 : null,
      predicted_grade: normalizedConfirmedGrade,
      probabilities: oneHotProbabilities(normalizedConfirmedGrade),
      is_finalized: true,
      prediction_basis: 'confirmed',
      debug: {
        observed_mean_pct: Math.round(observedMean * 1000) / 10,
        observed_sd_pct: Math.round(observedSd * 1000) / 10,
        base_mean_pct: displayPct != null ? Math.round(displayPct * 1000) / 10 : null,
        sigma_pct: 0,
        adv_observed_mean_pct: advObservedMean != null ? Math.round(advObservedMean * 1000) / 10 : null,
        discount_rate_pct: 0,
        prob_a_star_joint: normalizedConfirmedGrade === 'A*' ? 1 : 0,
        a_star_caution_factor: 1,
      },
    };
  }

  // 所有配置单元均已有实考或重考成绩时，结果已经确定，不再使用随机预测。
  const isFinalized = units.length > 0 && missing.length === 0;
  if (isFinalized) {
    const finalizedPct = totalWeight > 0
      ? observed.reduce((s, u) => s + u.exam_pct * u.max_score * (u.weight || 1), 0) / totalWeight
      : 0;
    const finalizedAdvancedPct = advScoreMax > 0
      ? advObserved.reduce((s, u) => s + u.exam_pct * u.max_score * (u.weight || 1), 0) / advScoreMax
      : null;
    const finalizedGrade = gradeFromPercentages(
      finalizedPct,
      finalizedAdvancedPct || 0,
      advScoreMax > 0
    );

    return {
      course_id,
      course_name,
      board,
      student_course_id,
      coverage: 1,
      confidence: 1,
      observed_units: observed.length,
      total_units: units.length,
      predicted_pct: Math.round(finalizedPct * 1000) / 10,
      predicted_total_score: Math.round(finalizedPct * totalWeight),
      max_total_score: Math.round(totalWeight),
      predicted_advanced_pct: finalizedAdvancedPct != null ? Math.round(finalizedAdvancedPct * 1000) / 10 : null,
      predicted_grade: finalizedGrade,
      probabilities: oneHotProbabilities(finalizedGrade),
      is_finalized: true,
      prediction_basis: 'confirmed',
      debug: {
        observed_mean_pct: Math.round(finalizedPct * 1000) / 10,
        observed_sd_pct: Math.round(observedSd * 1000) / 10,
        base_mean_pct: Math.round(finalizedPct * 1000) / 10,
        sigma_pct: 0,
        adv_observed_mean_pct: advObservedMean != null ? Math.round(advObservedMean * 1000) / 10 : null,
        discount_rate_pct: 0,
        prob_a_star_joint: finalizedGrade === 'A*' ? 1 : 0,
        a_star_caution_factor: 1,
      },
    };
  }

  // Monte Carlo
  const totals = [];
  const totalsPct = [];
  const totalsAdvPct = [];
  const totalScoreMax = totalWeight;

  for (let i = 0; i < cfg.samples; i++) {
    let totalScore = 0;
    let advScore = 0;

    for (const u of units) {
      const w = u.max_score * (u.weight || 1);
      const pct = u.exam_pct != null
        ? u.exam_pct
        : clamp(baseMean + randn() * sigma, 0, 1);
      totalScore += pct * w;
      if (u.is_advanced) advScore += pct * w;
    }
    totals.push(totalScore);
    totalsPct.push(totalScoreMax > 0 ? totalScore / totalScoreMax : 0);
    totalsAdvPct.push(advScoreMax > 0 ? advScore / advScoreMax : 0);
  }

  const predPct = mean(totalsPct);
  const predAdvPct = advScoreMax > 0 ? mean(totalsAdvPct) : null;

  // 基础等级概率（按总分占比）
  const probGE = (thresholdPct) => {
    if (!totalsPct.length) return 0;
    const hit = totalsPct.filter(p => p >= thresholdPct).length;
    return hit / totalsPct.length;
  };

  // A*：联合条件（总分>=80% 且 高阶>=90%）
  // 同时：在未考任何高阶单元之前，概率需要“谨慎下调”
  const probAStarJoint = (() => {
    if (!totalsPct.length) return 0;
    const hit = totalsPct.filter((p, idx) => {
      const adv = totalsAdvPct[idx] ?? 0;
      return p >= 0.8 && adv >= 0.9;
    }).length;
    return hit / totalsPct.length;
  })();

  const hasAnyAdvancedUnit = advScoreMax > 0;
  const hasAnyAdvancedObserved = advObserved.length > 0;
  const aStarCautionFactor = hasAnyAdvancedUnit && !hasAnyAdvancedObserved ? 0.25 : 1.0;
  const probAStar = clamp(probAStarJoint * aStarCautionFactor, 0, 1);

  const probabilities = {
    'A*': probAStar,
    // A：总分>=80% 但未满足 A* 联合条件
    'A': clamp(probGE(gradeThresholdPct('A')) - probAStar, 0, 1),
    'B': clamp(probGE(gradeThresholdPct('B')) - probGE(gradeThresholdPct('A')), 0, 1),
    'C': clamp(probGE(gradeThresholdPct('C')) - probGE(gradeThresholdPct('B')), 0, 1),
    'D': clamp(probGE(gradeThresholdPct('D')) - probGE(gradeThresholdPct('C')), 0, 1),
    'E': clamp(probGE(gradeThresholdPct('E')) - probGE(gradeThresholdPct('D')), 0, 1),
  };
  probabilities.U = clamp(1 - probGE(gradeThresholdPct('E')), 0, 1);

  // 置信度：覆盖率 + （方差越小越自信）
  const confidence = clamp(0.15 + 0.7 * coverage + 0.15 * (1 - (sigma - cfg.minSigma) / (cfg.maxSigma - cfg.minSigma)), 0, 1);

  // 对外展示的“主推等级”：如果 A 概率低于10%，就展示 B（或更低）中概率最高的一个
  const primaryGrade = (() => {
    const pA = probabilities.A;
    const candidates = ['A*', 'A', 'B', 'C', 'D', 'E', 'U'];
    if (pA >= 0.1) {
      // 在 A 概率足够时，优先输出 A/A* 中概率更高者；否则输出整体最大者
      const pAStar = probabilities['A*'];
      if (pAStar > pA) return 'A*';
      return 'A';
    }
    // A 太低：输出 B 及以下的最大概率
    let best = 'B';
    let bestP = probabilities.B;
    for (const g of ['C', 'D', 'E', 'U']) {
      const pv = probabilities[g];
      if (pv > bestP) { best = g; bestP = pv; }
    }
    return best;
  })();

  return {
    course_id,
    course_name,
    board,
    student_course_id,
    coverage: Math.round(coverage * 1000) / 1000,
    confidence: Math.round(confidence * 1000) / 1000,
    observed_units: observed.length,
    total_units: units.length,
    predicted_pct: Math.round(predPct * 1000) / 10, // 0-100 with 0.1 precision
    predicted_total_score: Math.round(predPct * totalScoreMax),
    max_total_score: Math.round(totalScoreMax),
    predicted_advanced_pct: predAdvPct != null ? Math.round(predAdvPct * 1000) / 10 : null,
    predicted_grade: primaryGrade,
    probabilities,
    is_finalized: false,
    prediction_basis: 'estimate',
    debug: {
      observed_mean_pct: Math.round(observedMean * 1000) / 10,
      observed_sd_pct: Math.round(observedSd * 1000) / 10,
      base_mean_pct: Math.round(baseMean * 1000) / 10,
      sigma_pct: Math.round(sigma * 1000) / 10,
      adv_observed_mean_pct: advObservedMean != null ? Math.round(advObservedMean * 1000) / 10 : null,
      discount_rate_pct: observedMean >= 0.8 ? Math.round(discountRate * 1000) / 10 : 0,
      prob_a_star_joint: Math.round(probAStarJoint * 1000) / 1000,
      a_star_caution_factor: aStarCautionFactor,
    },
  };
}

module.exports = {
  predictCourseFromUnits,
};

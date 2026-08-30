export type FlexibleUnitRule = {
  totalUnits: number;
  coreUnitCodes: string[];
  choiceUnitCodes: string[];
  choiceCount: number;
};

const RULES: Record<string, FlexibleUnitRule> = {
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

export function getFlexibleUnitRule(subjectCode?: string | null): FlexibleUnitRule | null {
  return RULES[String(subjectCode || '').trim().toUpperCase()] || null;
}

export function isFlexibleUnitCode(subjectCode: string | null | undefined, unitCode: string | null | undefined): boolean {
  const rule = getFlexibleUnitRule(subjectCode);
  if (!rule) return true;
  const code = String(unitCode || '').trim().toUpperCase();
  return [...rule.coreUnitCodes, ...rule.choiceUnitCodes].includes(code);
}

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { studentApi } from '@/services/api';
import {
  clampActiveGrade,
  mergeCanonicalCohortList,
  yearToCanonicalGrade,
  MIN_ENROLLMENT_YEAR,
} from '@/lib/cohortLabels';

type GradeContextValue = {
  activeGrade: string;
  setActiveGrade: (grade: string) => void;
  availableGrades: string[];
  setAvailableGrades: React.Dispatch<React.SetStateAction<string[]>>;
  activeAcademicYear: string;
  setActiveAcademicYear: (year: string) => void;
};

const STORAGE_KEY = 'activeGrade';
const STORAGE_YEAR_KEY = 'activeAcademicYear';

const GradeContext = createContext<GradeContextValue | null>(null);

export function GradeProvider({ children }: { children: React.ReactNode }) {
  const [availableGrades, setAvailableGrades] = useState<string[]>(() => mergeCanonicalCohortList([]));
  const [activeGrade, setActiveGradeState] = useState<string>(() => {
    try {
      return clampActiveGrade(localStorage.getItem(STORAGE_KEY));
    } catch {
      return yearToCanonicalGrade(MIN_ENROLLMENT_YEAR);
    }
  });
  const [activeAcademicYear, setActiveAcademicYearState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_YEAR_KEY) || new Date().getFullYear().toString();
  });

  const setActiveGrade = (grade: string) => {
    const next = clampActiveGrade(grade);
    setActiveGradeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const setActiveAcademicYear = (year: string) => {
    setActiveAcademicYearState(year);
    localStorage.setItem(STORAGE_YEAR_KEY, year);
  };

  useEffect(() => {
    let cancelled = false;
    studentApi
      .getAll({ status: 'active' })
      .then((list) => {
        if (cancelled) return;
        const fromDb = list.map((s) => s.grade).filter(Boolean) as string[];
        setAvailableGrades(mergeCanonicalCohortList(fromDb));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<GradeContextValue>(
    () => ({
      activeGrade,
      setActiveGrade,
      availableGrades,
      setAvailableGrades,
      activeAcademicYear,
      setActiveAcademicYear,
    }),
    [activeGrade, availableGrades, activeAcademicYear]
  );

  return <GradeContext.Provider value={value}>{children}</GradeContext.Provider>;
}

export function useGrade() {
  const ctx = useContext(GradeContext);
  if (!ctx) throw new Error('useGrade must be used within GradeProvider');
  return ctx;
}

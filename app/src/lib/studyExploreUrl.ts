/** 院校探索静态站（study-app）地址：开发默认 Vite 3000，生产默认同域 /study/ */
export function getStudyExploreUrl(): string {
  const configured = import.meta.env.VITE_STUDY_EXPLORE_URL;
  if (configured != null && String(configured).trim() !== '') {
    return String(configured).trim();
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:3000/study/';
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/study/`;
  }
  return '/study/';
}

export function openStudyExploreWindow(): void {
  window.open(getStudyExploreUrl(), '_blank', 'noopener,noreferrer');
}

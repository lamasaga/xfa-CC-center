import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface University {
  id: string;
  name: string;
  name_en: string;
  region: string;
  country: string;
  city: string;
  ranking: {
    qs?: number;
    us_news?: number;
    the?: number;
  };
  admission: {
    a_level?: string;
    acceptance_rate?: string | number;
    ielts?: string;
    toefl?: string;
    portfolio_required?: boolean;
    portfolio_weight?: string;
    deadline?: string;
    sat?: string;
    act?: string;
  };
  tuition: {
    amount?: number;
    currency?: string;
    period?: string;
  };
  majors: string[];
  is_art_school: boolean;
  admission_difficulty?: number;
  location?: {
    lat?: number;
    lng?: number;
  };
  [key: string]: unknown;
}

export interface ThirdPartyData {
  metadata?: Record<string, unknown>;
  cities_living_costs?: Record<string, unknown>;
  salaries?: Record<string, unknown>;
  employment?: Record<string, unknown>;
  admission_stats?: Record<string, unknown>;
  student_reviews?: Record<string, unknown>;
  salary_by_major?: Record<string, unknown>;
  china_specific_admission?: Record<string, unknown>;
  campus_safety?: Record<string, unknown>;
  regional_summary?: Record<string, unknown>;
  [key: string]: unknown;
}

interface DataContextType {
  universities: University[];
  thirdParty: ThirdPartyData | null;
  loading: boolean;
  error: string | null;
}

const DataContext = createContext<DataContextType>({
  universities: [],
  thirdParty: null,
  loading: true,
  error: null,
});

export function useData() {
  return useContext(DataContext);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [universities, setUniversities] = useState<University[]>([]);
  const [thirdParty, setThirdParty] = useState<ThirdPartyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [uniRes, tpRes, imgRes] = await Promise.all([
        fetch('./universities_data.json'),
        fetch('./third_party_summary.json'),
        fetch('./university-images/mapping.json'),
      ]);

      if (!uniRes.ok) throw new Error(`Failed to load universities: ${uniRes.status}`);
      if (!tpRes.ok) throw new Error(`Failed to load third party data: ${tpRes.status}`);

      const [uniData, tpData, imgMapping] = await Promise.all([
        uniRes.json(),
        tpRes.json(),
        imgRes.ok ? imgRes.json() : Promise.resolve({}),
      ]);

      const rawUniversities = Array.isArray(uniData) ? uniData : uniData.universities || [];

      // Merge image paths from mapping
      const universitiesWithImages = rawUniversities.map((u: Record<string, unknown>) => {
        const entry = imgMapping[u.id as string];
        if (entry?.filename) {
          return { ...u, image: `./university-images/${entry.filename}` };
        }
        return u;
      });

      setUniversities(universitiesWithImages);
      setThirdParty(tpData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error loading data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <DataContext.Provider value={{ universities, thirdParty, loading, error }}>
      {children}
    </DataContext.Provider>
  );
}

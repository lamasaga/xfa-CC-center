import { Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from '@/context/DataContext';
import { CompareProvider } from '@/context/CompareContext';
import Layout from '@/components/Layout';
import Explore from '@/pages/Explore';
import LivingCost from '@/pages/LivingCost';
import Career from '@/pages/Career';
import Guide from '@/pages/Guide';

export default function App() {
  return (
    <DataProvider>
      <CompareProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Explore />} />
            <Route path="/explore" element={<Navigate to="/" replace />} />
            <Route path="/living-cost" element={<LivingCost />} />
            <Route path="/career" element={<Career />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </CompareProvider>
    </DataProvider>
  );
}

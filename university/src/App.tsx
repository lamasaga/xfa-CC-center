import { Routes, Route } from 'react-router-dom';
import { DataProvider } from '@/context/DataContext';
import { CompareProvider } from '@/context/CompareContext';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
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
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/living-cost" element={<LivingCost />} />
            <Route path="/career" element={<Career />} />
            <Route path="/guide" element={<Guide />} />
          </Routes>
        </Layout>
      </CompareProvider>
    </DataProvider>
  );
}

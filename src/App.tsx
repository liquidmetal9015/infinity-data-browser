import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SearchPage } from './pages/SearchPage';
import { ReferencePage } from './pages/ReferencePage';
import { RangesPage } from './pages/RangesPage';
import { ComparePage } from './pages/ComparePage';
import { FireteamsPage } from './pages/FireteamsPage';
import { UnitSearchPage } from './pages/UnitSearchPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<SearchPage />} />
          <Route path="/reference" element={<ReferencePage />} />
          <Route path="/ranges" element={<RangesPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/fireteams" element={<FireteamsPage />} />
          <Route path="/units" element={<UnitSearchPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;

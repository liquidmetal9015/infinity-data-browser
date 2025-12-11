import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SearchPage } from './pages/SearchPage';
import { ReferencePage } from './pages/ReferencePage';
import { RangesPage } from './pages/RangesPage';
import { ComparePage } from './pages/ComparePage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<SearchPage />} />
          <Route path="/reference" element={<ReferencePage />} />
          <Route path="/ranges" element={<RangesPage />} />
          <Route path="/compare" element={<ComparePage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;

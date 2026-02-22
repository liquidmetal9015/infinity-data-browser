import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SearchPage } from './pages/SearchPage';
import { ReferencePage } from './pages/ReferencePage';
import { RangesPage } from './pages/RangesPage';
import { ComparePage } from './pages/ComparePage';
import { FireteamsPage } from './pages/FireteamsPage';
import { UnitSearchPage } from './pages/UnitSearchPage';
import { ListBuilderPage } from './pages/ListBuilderPage';
import { DiceCalculatorPage } from './pages/DiceCalculatorPage';
import { ClassifiedsPage } from './pages/ClassifiedsPage';
import { WorkspaceView } from './components/Workspace/WorkspaceView';

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
          <Route path="/builder" element={<ListBuilderPage />} />
          <Route path="/calculator" element={<DiceCalculatorPage />} />
          <Route path="/classifieds" element={<ClassifiedsPage />} />
          <Route path="/workspace" element={<WorkspaceView />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;


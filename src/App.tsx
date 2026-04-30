import { WorkspaceView } from './components/Workspace/WorkspaceView';
import { useContextMenuStore } from './stores/useContextMenuStore';
import { NavBar } from './components/NavBar';
import { ContextMenu } from './components/ContextMenu';
import { Routes, Route } from 'react-router-dom';
import { MyLists } from './pages/MyLists';
import { SearchPage } from './pages/SearchPage';
import { ReferencePage } from './pages/ReferencePage';
import { RangesPage } from './pages/RangesPage';
import { ComparePage } from './pages/ComparePage';

// Global App Event Handler
function GlobalContextMenuHandler({ children }: { children: React.ReactNode }) {
  const showMenu = useContextMenuStore(s => s.showMenu);

  return (
    <div
      className="h-full w-full"
      onContextMenu={(e) => {
        // Only trigger if another more specific component didn't already prevent default
        if (e.defaultPrevented) return;

        e.preventDefault();
        showMenu(e.clientX, e.clientY, [
          { label: 'Infinity Data Manager', action: () => { }, icon: <span className="text-xl">∞</span> },
          { divider: true, action: () => { } },
          { label: 'Reload Application', action: () => window.location.reload() }
        ]);
      }}
    >
      {children}
    </div>
  )
}

function App() {
  return (
    <GlobalContextMenuHandler>
      <div className="app-container flex flex-col h-screen">
        <NavBar />
        <Routes>
          <Route path="/" element={<WorkspaceView />} />
          <Route path="/lists" element={<MyLists />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/reference" element={<ReferencePage />} />
          <Route path="/ranges" element={<RangesPage />} />
          <Route path="/compare" element={<ComparePage />} />
        </Routes>
      </div>
      <ContextMenu />
    </GlobalContextMenuHandler>
  );
}

export default App;

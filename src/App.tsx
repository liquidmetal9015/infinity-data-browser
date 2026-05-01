import { WorkspaceView } from './components/Workspace/WorkspaceView';
import { FloatingToolOverlay } from './components/Workspace/FloatingToolOverlay';
import { useContextMenuStore } from './stores/useContextMenuStore';
import { NavBar } from './components/NavBar';
import { ContextMenu } from './components/ContextMenu';
import { Routes, Route } from 'react-router-dom';
import { MyLists } from './pages/MyLists';
import { SearchPage } from './pages/SearchPage';
import { ReferencePage } from './pages/ReferencePage';
import { RangesPage } from './pages/RangesPage';
import { ComparePage } from './pages/ComparePage';
import { ListsComparePage } from './pages/ListsComparePage';
import { ListsOverviewPage } from './pages/ListsOverviewPage';

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
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <Routes>
            <Route path="/" element={<WorkspaceView />} />
            <Route path="/lists" element={<MyLists />} />
            <Route path="/lists/overview" element={<ListsOverviewPage />} />
            <Route path="/lists/compare" element={<ListsComparePage />} />
            <Route path="/search" element={<div className="flex-1 overflow-y-auto"><SearchPage /></div>} />
            <Route path="/reference" element={<div className="flex-1 overflow-y-auto"><ReferencePage /></div>} />
            <Route path="/ranges" element={<div className="flex-1 overflow-y-auto"><RangesPage /></div>} />
            <Route path="/compare" element={<div className="flex-1 overflow-y-auto"><ComparePage /></div>} />
          </Routes>
        </div>
        <FloatingToolOverlay />
      </div>
      <ContextMenu />
    </GlobalContextMenuHandler>
  );
}

export default App;

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ContextMenu } from './components/ContextMenu';
import { useContextMenuStore } from './stores/useContextMenuStore';
import { SearchPage } from './pages/SearchPage';
import { ReferencePage } from './pages/ReferencePage';
import { RangesPage } from './pages/RangesPage';
import { ComparePage } from './pages/ComparePage';

// Lazy-loaded secondary tools and saved rosters
const DiceCalculatorPage = lazy(() => import('./pages/DiceCalculatorPage').then(m => ({ default: m.DiceCalculatorPage })));
const FireteamsPage = lazy(() => import('./pages/FireteamsPage').then(m => ({ default: m.FireteamsPage })));
const ClassifiedsPage = lazy(() => import('./pages/ClassifiedsPage').then(m => ({ default: m.ClassifiedsPage })));
const MyLists = lazy(() => import('./pages/MyLists').then(m => ({ default: m.MyLists })));
const ListsOverviewPage = lazy(() => import('./pages/ListsOverviewPage').then(m => ({ default: m.ListsOverviewPage })));
const ListsComparePage = lazy(() => import('./pages/ListsComparePage').then(m => ({ default: m.ListsComparePage })));
const WorkspaceView = lazy(() => import('./components/Workspace/WorkspaceView').then(m => ({ default: m.WorkspaceView })));

function LoadingFallback() {
  return (
    <div className="flex-1 flex items-center justify-center p-8 text-secondary">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading tool...</span>
      </div>
    </div>
  );
}

// Global App Event Handler
function GlobalContextMenuHandler({ children }: { children: React.ReactNode }) {
  const showMenu = useContextMenuStore(s => s.showMenu);

  return (
    <div
      className="h-full w-full"
      onContextMenu={(e) => {
        if (e.defaultPrevented) return;
        e.preventDefault();
        showMenu(e.clientX, e.clientY, [
          { label: 'Infinity Explorer', action: () => { }, icon: <span className="text-xl">∞</span> },
          { divider: true, action: () => { } },
          { label: 'Reload Application', action: () => window.location.reload() }
        ]);
      }}
    >
      {children}
    </div>
  );
}

function App() {
  return (
    <GlobalContextMenuHandler>
      <div className="app-container flex flex-col h-screen overflow-hidden">
        <NavBar />
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col relative pb-14 md:pb-0">
          <Routes>
            {/* Primary Data Exploration Routes */}
            <Route path="/" element={<div className="flex-1 overflow-y-auto"><SearchPage /></div>} />
            <Route path="/search" element={<div className="flex-1 overflow-y-auto"><SearchPage /></div>} />
            <Route path="/units" element={<Navigate to="/" replace />} />
            <Route path="/reference" element={<div className="flex-1 overflow-y-auto"><ReferencePage /></div>} />
            <Route path="/ranges" element={<div className="flex-1 overflow-y-auto"><RangesPage /></div>} />
            <Route path="/compare" element={<div className="flex-1 overflow-y-auto"><ComparePage /></div>} />

            {/* Standalone Secondary Tools */}
            <Route path="/calculator" element={<Suspense fallback={<LoadingFallback />}><div className="flex-1 overflow-y-auto"><DiceCalculatorPage /></div></Suspense>} />
            <Route path="/fireteams" element={<Suspense fallback={<LoadingFallback />}><div className="flex-1 overflow-y-auto"><FireteamsPage /></div></Suspense>} />
            <Route path="/classifieds" element={<Suspense fallback={<LoadingFallback />}><div className="flex-1 overflow-y-auto"><ClassifiedsPage /></div></Suspense>} />

            {/* Army Lists & Legacy Workspace */}
            <Route path="/lists" element={<Suspense fallback={<LoadingFallback />}><div className="flex-1 overflow-y-auto"><MyLists /></div></Suspense>} />
            <Route path="/lists/overview" element={<Suspense fallback={<LoadingFallback />}><div className="flex-1 overflow-y-auto"><ListsOverviewPage /></div></Suspense>} />
            <Route path="/lists/compare" element={<Suspense fallback={<LoadingFallback />}><div className="flex-1 overflow-y-auto"><ListsComparePage /></div></Suspense>} />
            <Route path="/workspace" element={<Suspense fallback={<LoadingFallback />}><WorkspaceView /></Suspense>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <MobileBottomNav />
      </div>
      <ContextMenu />
    </GlobalContextMenuHandler>
  );
}

export default App;

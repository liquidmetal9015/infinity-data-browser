import { WorkspaceView } from './components/Workspace/WorkspaceView';
import { useModalStore } from './stores/useModalStore';
import { useContextMenuStore } from './stores/useContextMenuStore';
import { UnitStatsModal } from './components/UnitStatsModal';
import { NavBar } from './components/NavBar';
import { ContextMenu } from './components/ContextMenu';

// Wrapper to access modal store for the key prop
function ModalWithKey() {
  const selectedUnit = useModalStore(s => s.selectedUnit);
  // Key forces remount when unit changes, resetting all internal state
  return <UnitStatsModal key={selectedUnit?.id ?? 'none'} />;
}

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
      <div className="app-container">
        <NavBar />
        <WorkspaceView />
      </div>
      <ModalWithKey />
      <ContextMenu />
    </GlobalContextMenuHandler>
  );
}

export default App;

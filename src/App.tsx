import { WorkspaceView } from './components/Workspace/WorkspaceView';
import { ModalProvider, useModal } from './context/ModalContext';
import { UnitStatsModal } from './components/UnitStatsModal';
import { NavBar } from './components/NavBar';
import { ContextMenuProvider, useContextMenu } from './context/ContextMenuContext';
import { ContextMenu } from './components/ContextMenu';

// Wrapper to access modal context for the key prop
function ModalWithKey() {
  const { selectedUnit } = useModal();
  // Key forces remount when unit changes, resetting all internal state
  return <UnitStatsModal key={selectedUnit?.id ?? 'none'} />;
}

// Global App Event Handler
function GlobalContextMenuHandler({ children }: { children: React.ReactNode }) {
  const { showMenu } = useContextMenu();

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
    <ContextMenuProvider>
      <GlobalContextMenuHandler>
        <ModalProvider>
          <div className="app-container">
            <NavBar />
            <WorkspaceView />
          </div>
          <ModalWithKey />
        </ModalProvider>
        <ContextMenu />
      </GlobalContextMenuHandler>
    </ContextMenuProvider>
  );
}

export default App;


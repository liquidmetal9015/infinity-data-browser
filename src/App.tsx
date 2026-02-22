import { WorkspaceView } from './components/Workspace/WorkspaceView';
import { ModalProvider, useModal } from './context/ModalContext';
import { UnitStatsModal } from './components/UnitStatsModal';
import { NavBar } from './components/NavBar';

// Wrapper to access modal context for the key prop
function ModalWithKey() {
  const { selectedUnit } = useModal();
  // Key forces remount when unit changes, resetting all internal state
  return <UnitStatsModal key={selectedUnit?.id ?? 'none'} />;
}

function App() {
  return (
    <ModalProvider>
      <div className="app-container">
        <NavBar />
        <WorkspaceView />
      </div>
      <ModalWithKey />
    </ModalProvider>
  );
}

export default App;


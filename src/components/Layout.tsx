import { Outlet } from 'react-router-dom';
import { DatabaseProvider } from '../context/DatabaseContext';
import { ModalProvider, useModal } from '../context/ModalContext';
import { UnitStatsModal } from './UnitStatsModal';
import { NavBar } from './NavBar';

// Wrapper to access modal context for the key prop
function ModalWithKey() {
    const { selectedUnit } = useModal();
    // Key forces remount when unit changes, resetting all internal state
    return <UnitStatsModal key={selectedUnit?.id ?? 'none'} />;
}

export function Layout() {
    return (
        <DatabaseProvider>
            <ModalProvider>
                <div className="app-container">
                    <NavBar />
                    <main className="main-content">
                        <Outlet />
                    </main>
                    <ModalWithKey />
                </div>
            </ModalProvider>
        </DatabaseProvider>
    );
}

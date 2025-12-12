import { Outlet } from 'react-router-dom';
import { DatabaseProvider } from '../context/DatabaseContext';
import { ModalProvider } from '../context/ModalContext';
import { UnitStatsModal } from './UnitStatsModal';
import { NavBar } from './NavBar';

export function Layout() {
    return (
        <DatabaseProvider>
            <ModalProvider>
                <div className="app-container">
                    <NavBar />
                    <main className="main-content">
                        <Outlet />
                    </main>
                    <UnitStatsModal />
                </div>
            </ModalProvider>
        </DatabaseProvider>
    );
}

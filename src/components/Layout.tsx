import { Outlet } from 'react-router-dom';
import { DatabaseProvider } from '../context/DatabaseContext';
import { NavBar } from './NavBar';

export function Layout() {
    return (
        <DatabaseProvider>
            <div className="app-container">
                <NavBar />
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </DatabaseProvider>
    );
}

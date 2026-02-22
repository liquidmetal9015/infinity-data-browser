import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';

export function Layout() {
    return (
        <div className="app-container">
            <NavBar />
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}

import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { toggleSidebar } from '../../ui.slice';
import { Sidebar } from './Sidebar';

const TOGGLE_ID = 'playlists-drawer';

export const AppShell = ({ children }: { children: React.ReactNode }) => {
    const open = useAppSelector((state) => state.ui.sidebarOpen);
    const dispatch = useAppDispatch();

    return (
        <div className="drawer lg:drawer-open min-h-screen">
            <input
                id={TOGGLE_ID}
                type="checkbox"
                className="drawer-toggle"
                aria-hidden="true"
                tabIndex={-1}
                checked={open}
                onChange={(event) => dispatch(toggleSidebar(event.currentTarget.checked))}
            />
            <div className="drawer-content min-w-0">
                <main className="px-4 pt-5 pb-24 sm:px-8 md:pt-10 lg:px-14">{children}</main>
            </div>
            <div className="drawer-side z-30">
                <label htmlFor={TOGGLE_ID} aria-label="Close playlists" className="drawer-overlay" />
                <Sidebar />
            </div>
        </div>
    );
};

import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { toggleSidebar } from '../../ui.slice';
import { Sidebar } from './Sidebar';

const TOGGLE_ID = 'playlists-drawer';

export const AppShell = ({ children }: { children: React.ReactNode }) => {
    const open = useAppSelector((state) => state.ui.sidebarOpen);
    const dispatch = useAppDispatch();

    return (
        <div className="drawer md:drawer-open min-h-screen">
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
                <main className="px-4 pt-5 pb-24 sm:px-8 md:pt-10 lg:px-14">
                    <button
                        type="button"
                        className="btn btn-ghost btn-square -ml-2 mb-2 md:hidden"
                        aria-label="Show playlists"
                        onClick={() => dispatch(toggleSidebar(true))}
                    >
                        <Icon name="menu" size={22} />
                    </button>
                    <div className="max-w-4xl">{children}</div>
                </main>
            </div>
            <div className="drawer-side z-30">
                <label htmlFor={TOGGLE_ID} aria-label="Close playlists" className="drawer-overlay" />
                <Sidebar />
            </div>
        </div>
    );
};

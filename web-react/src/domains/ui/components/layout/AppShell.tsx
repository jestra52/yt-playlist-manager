import MenuIcon from '@mui/icons-material/Menu';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { toggleSidebar } from '../../ui.slice';
import styles from './AppShell.module.scss';
import { Sidebar } from './Sidebar';

export const AppShell = ({ children }: { children: React.ReactNode }) => {
    const wide = useMediaQuery((theme) => theme.breakpoints.up('md'));
    const open = useAppSelector((state) => state.ui.sidebarOpen);
    const dispatch = useAppDispatch();

    return (
        <div className={styles.root}>
            <Drawer
                variant={wide ? 'permanent' : 'temporary'}
                open={wide || open}
                onClose={() => dispatch(toggleSidebar(false))}
                className={styles.drawer}
                slotProps={{ paper: { className: styles.drawerPaper } }}
            >
                <Sidebar />
            </Drawer>
            <main className={styles.main}>
                {!wide && (
                    <IconButton
                        aria-label="Show playlists"
                        onClick={() => dispatch(toggleSidebar(true))}
                        className={styles.menuButton}
                    >
                        <MenuIcon />
                    </IconButton>
                )}
                {children}
            </main>
        </div>
    );
};

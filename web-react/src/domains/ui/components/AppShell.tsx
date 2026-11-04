import MenuIcon from '@mui/icons-material/Menu';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { sidebar } from '../theme';
import { toggleSidebar } from '../ui.slice';
import { ThemeSwitch } from './ThemeSwitch';

const SOURCE_URL = 'https://github.com/jestra52/yt-playlist-manager';

const Brand = () => (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1.5, pb: 2.5 }}>
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="5" y="8" width="14" height="3.4" rx="1.7" fill="currentColor" />
            <rect x="5" y="14.3" width="14" height="3.4" rx="1.7" fill="currentColor" />
            <rect x="5" y="20.6" width="9" height="3.4" rx="1.7" fill="currentColor" />
            <path d="M20.5 17.5v8.5l7-4.25z" fill="#ff5a4f" />
        </svg>
        <Box>
            <Typography component="p" variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1, fontSize: '1.25rem' }}>
                Yuzu Tapes
            </Typography>
            <Typography component="p" sx={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.7 }}>
                Playlist Manager
            </Typography>
        </Box>
    </Stack>
);

const Sidebar = () => (
    <Stack
        component="nav"
        aria-label="Playlists"
        sx={(theme) => ({
            width: sidebar.width,
            minHeight: '100%',
            px: 1.5,
            pt: 2.5,
            pb: 2,
            color: sidebar.text,
            backgroundColor: sidebar.background,
            ...theme.applyStyles('dark', { backgroundColor: sidebar.backgroundDark }),
        })}
    >
        <Brand />
        <Typography sx={{ px: 1.5, fontSize: '0.875rem', opacity: 0.7 }}>Playlists come in the next step.</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Stack spacing={1.5} sx={{ px: 1.5, fontSize: '0.8125rem' }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Appearance</span>
                <ThemeSwitch />
            </Stack>
            <Link href={SOURCE_URL} target="_blank" rel="noopener noreferrer" color="inherit" sx={{ opacity: 0.7 }}>
                Source code · AGPL-3.0
            </Link>
        </Stack>
    </Stack>
);

export const AppShell = ({ children }: { children: React.ReactNode }) => {
    const wide = useMediaQuery((theme) => theme.breakpoints.up('md'));
    const open = useAppSelector((state) => state.ui.sidebarOpen);
    const dispatch = useAppDispatch();

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
            <Drawer
                variant={wide ? 'permanent' : 'temporary'}
                open={wide || open}
                onClose={() => dispatch(toggleSidebar(false))}
                slotProps={{ paper: { sx: { border: 0, backgroundColor: 'transparent' } } }}
                sx={{ width: wide ? sidebar.width : 0, flexShrink: 0 }}
            >
                <Sidebar />
            </Drawer>
            <Box component="main" sx={{ flexGrow: 1, minWidth: 0, px: { xs: 2, sm: 4 }, pt: 2.5, pb: 12 }}>
                {!wide && (
                    <IconButton
                        aria-label="Show playlists"
                        onClick={() => dispatch(toggleSidebar(true))}
                        sx={{ ml: -1, mb: 1 }}
                    >
                        <MenuIcon />
                    </IconButton>
                )}
                {children}
            </Box>
        </Box>
    );
};

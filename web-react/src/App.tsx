import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { Provider } from 'react-redux';
import type { AppStore } from './app/store';
import { AppShell } from './domains/ui/components/AppShell';
import { theme } from './domains/ui/theme';

export const App = ({ store }: { store: AppStore }) => (
    <Provider store={store}>
        <ThemeProvider theme={theme} defaultMode="system">
            <CssBaseline enableColorScheme />
            <AppShell>
                <Typography variant="h3" component="h1" sx={{ mt: 2 }}>
                    React beta
                </Typography>
                <Typography sx={{ mt: 1.5, maxWidth: 560, color: 'text.secondary' }}>
                    The React version of Yuzu Tapes Playlist Manager. It runs only on this computer while it catches up
                    with the current app; playlists and videos come next.
                </Typography>
            </AppShell>
        </ThemeProvider>
    </Provider>
);

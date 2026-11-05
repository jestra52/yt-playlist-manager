import CssBaseline from '@mui/material/CssBaseline';
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import { Provider } from 'react-redux';
import type { AppStore } from './app/store';
import { Notices } from './domains/ui/components/feedback/Notices';
import { AppShell } from './domains/ui/components/layout/AppShell';
import { theme } from './domains/ui/theme';
import { PlaylistPage } from './domains/playlists/components/page/PlaylistPage';

export const App = ({ store }: { store: AppStore }) => (
    <Provider store={store}>
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme} defaultMode="system">
                <CssBaseline enableColorScheme />
                <AppShell>
                    <PlaylistPage />
                </AppShell>
                <Notices />
            </ThemeProvider>
        </StyledEngineProvider>
    </Provider>
);

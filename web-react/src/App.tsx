import CssBaseline from '@mui/material/CssBaseline';
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import { Provider } from 'react-redux';
import type { AppStore } from './app/store';
import { Notices } from './domains/ui/components/feedback/Notices';
import { AppShell } from './domains/ui/components/layout/AppShell';
import { ThemeSync } from './domains/ui/components/appearance/ThemeSync';
import { theme } from './domains/ui/theme';
import { PlaylistPage } from './domains/playlists/components/page/PlaylistPage';
import { SyncSettingsDialog } from './domains/sync/components/settings/SyncSettingsDialog';

export const App = ({ store }: { store: AppStore }) => (
    <Provider store={store}>
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme} defaultMode={store.getState().ui.theme} storageManager={null} noSsr>
                <ThemeSync />
                <CssBaseline enableColorScheme />
                <AppShell>
                    <PlaylistPage />
                </AppShell>
                <SyncSettingsDialog />
                <Notices />
            </ThemeProvider>
        </StyledEngineProvider>
    </Provider>
);

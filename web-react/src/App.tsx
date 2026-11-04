import CssBaseline from '@mui/material/CssBaseline';
import { StyledEngineProvider } from '@mui/material/styles';
import { ThemeProvider } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { Provider } from 'react-redux';
import type { AppStore } from './app/store';
import { AppShell } from './domains/ui/components/layout/AppShell';
import { theme } from './domains/ui/theme';
import styles from './App.module.scss';

export const App = ({ store }: { store: AppStore }) => (
    <Provider store={store}>
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme} defaultMode="system">
                <CssBaseline enableColorScheme />
                <AppShell>
                    <Typography variant="h3" component="h1" className={styles.title}>
                        React beta
                    </Typography>
                    <Typography className={styles.intro}>
                        The React version of Yuzu Tapes Playlist Manager. It runs only on this computer while it catches
                        up with the current app; playlists and videos come next.
                    </Typography>
                </AppShell>
            </ThemeProvider>
        </StyledEngineProvider>
    </Provider>
);

import { Provider } from 'react-redux';
import type { AppStore } from './app/store';
import { PlaylistPage } from './domains/playlists/components/page/PlaylistPage';
import { SyncSettingsDialog } from './domains/sync/components/settings/SyncSettingsDialog';
import { ThemeSync } from './domains/ui/components/appearance/ThemeSync';
import { Notices } from './domains/ui/components/feedback/Notices';
import { AppShell } from './domains/ui/components/layout/AppShell';

export const App = ({ store }: { store: AppStore }) => (
    <Provider store={store}>
        <ThemeSync />
        <AppShell>
            <PlaylistPage />
        </AppShell>
        <SyncSettingsDialog />
        <Notices />
    </Provider>
);

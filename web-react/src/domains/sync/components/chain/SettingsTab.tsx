import { AutoSyncToggle } from '../connection/AutoSyncToggle';
import { ExportDatabase } from '../connection/ExportDatabase';

export const SettingsTab = () => (
    <>
        <AutoSyncToggle />
        <ExportDatabase />
    </>
);

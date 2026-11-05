import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { AppDialog } from '../../../ui/components/dialog/AppDialog';
import { closeSettings } from '../../../ui/ui.slice';
import { cancelPairing } from '../../pairing.thunks';
import { SyncSettings } from './SyncSettings';

export const SyncSettingsDialog = () => {
    const open = useAppSelector((state) => state.ui.settingsOpen);
    const dispatch = useAppDispatch();

    return (
        <AppDialog
            open={open}
            title="Sync across devices"
            onClose={() => {
                // A pairing code is only shown while someone is looking at it.
                dispatch(cancelPairing());
                dispatch(closeSettings());
            }}
        >
            <SyncSettings />
        </AppDialog>
    );
};

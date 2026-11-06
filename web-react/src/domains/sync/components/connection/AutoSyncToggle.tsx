import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { selectSyncSettings } from '../../sync.selectors';
import { saveSyncSettings } from '../../sync.thunks';

export const AutoSyncToggle = () => {
    const { autoSync } = useAppSelector(selectSyncSettings);
    const dispatch = useAppDispatch();

    return (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
                type="checkbox"
                role="switch"
                className="toggle toggle-sm"
                checked={autoSync}
                onChange={(e) => dispatch(saveSyncSettings({ autoSync: e.target.checked }))}
            />
            Sync automatically after changes
        </label>
    );
};

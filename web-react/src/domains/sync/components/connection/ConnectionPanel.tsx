import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { selectSyncSettings } from '../../sync.selectors';
import { saveSyncSettings, testConnection } from '../../sync.thunks';
import { Collapsible } from '../settings/Collapsible';
import { Field } from '../settings/Field';

export const ConnectionPanel = () => {
    const settings = useAppSelector(selectSyncSettings);
    const dispatch = useAppDispatch();
    const [apiUrl, setApiUrl] = useState(settings.apiUrl);
    const [autoSync, setAutoSync] = useState(settings.autoSync);
    const [testing, setTesting] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

    const test = async () => {
        setTesting(true);
        setResult(await testConnection({ apiUrl }));
        setTesting(false);
    };

    return (
        <Collapsible title="Connection">
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    dispatch(saveSyncSettings({ apiUrl, autoSync }));
                    setResult({ ok: true, message: 'Saved.' });
                }}
            >
                <Field
                    label="API address"
                    hint={
                        <>
                            Keep <code>/api</code>: the Netlify site forwards it to the API. Changing it leaves the
                            current sync chain.
                        </>
                    }
                >
                    <input
                        className="input w-full"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        placeholder="/api"
                        autoComplete="off"
                        spellCheck={false}
                    />
                </Field>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        role="switch"
                        className="toggle toggle-sm"
                        checked={autoSync}
                        onChange={(e) => setAutoSync(e.target.checked)}
                    />
                    Sync automatically after changes
                </label>
                {result && (
                    <div
                        role="status"
                        className={`alert alert-soft mt-3 text-sm ${result.ok ? 'alert-success' : 'alert-error'}`}
                    >
                        {result.message}
                    </div>
                )}
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button className="btn btn-sm" type="button" disabled={testing} onClick={test}>
                        {testing && <span className="loading loading-spinner loading-xs" />}
                        {testing ? 'Checking…' : 'Test connection'}
                    </button>
                    <button className="btn btn-primary btn-sm" type="submit">
                        Save
                    </button>
                </div>
            </form>
        </Collapsible>
    );
};

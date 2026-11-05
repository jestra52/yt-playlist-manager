import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { selectSyncSettings } from '../../sync.selectors';
import { saveSyncSettings, testConnection } from '../../sync.thunks';
import { Collapsible } from '../settings/Collapsible';
import { Field } from '../settings/Field';
import fields from '../settings/Field.module.scss';
import styles from './ConnectionPanel.module.scss';

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
                        className={fields.input}
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        placeholder="/api"
                        autoComplete="off"
                        spellCheck={false}
                    />
                </Field>
                <FormControlLabel
                    className={styles.auto}
                    label="Sync automatically after changes and every minute"
                    control={<Switch size="small" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />}
                />
                {result && (
                    <Alert severity={result.ok ? 'success' : 'error'} role="status" className={styles.result}>
                        {result.message}
                    </Alert>
                )}
                <div className={fields.buttons}>
                    <Button
                        variant="contained"
                        color="inherit"
                        size="small"
                        className={fields.soft}
                        disabled={testing}
                        startIcon={testing ? <CircularProgress size={14} color="inherit" /> : undefined}
                        onClick={test}
                    >
                        {testing ? 'Checking…' : 'Test connection'}
                    </Button>
                    <Button type="submit" variant="contained" size="small">
                        Save
                    </Button>
                </div>
            </form>
        </Collapsible>
    );
};

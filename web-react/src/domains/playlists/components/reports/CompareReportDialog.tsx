import FileUploadOutlined from '@mui/icons-material/FileUploadOutlined';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import { compareReport, FORMATS, parseReport } from '@ytpm/core/playlists/report-compare';
import { useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { AppDialog } from '../../../ui/components/dialog/AppDialog';
import type { DialogControls } from '../../../ui/components/dialog/useDialog';
import { selectAllVideos } from '../../../videos/videos.selectors';
import { addMissingFromReport } from '../../playlists.thunks';
import styles from './CompareReportDialog.module.scss';
import { MissingEntries } from './MissingEntries';

const EXAMPLE =
    'Total videos: 153\nFormat: number: title | artist\n1: Plastic Love | Mariya Takeuchi\n2: Windy Summer | Anri';

export const CompareReportDialog = ({ playlistId, ...dialog }: { playlistId: string } & DialogControls) => {
    const { onClose } = dialog;
    const [text, setText] = useState('');
    const [fileName, setFileName] = useState('');
    const all = useAppSelector(selectAllVideos);
    const dispatch = useAppDispatch();

    const result = useMemo(() => {
        if (!text.trim()) return undefined;
        const report = parseReport(text);
        if (!report.entries.length) return null;
        return compareReport(
            report,
            all.filter((v) => v.playlistId === playlistId),
        );
    }, [text, all, playlistId]);

    const missing = result?.missing ?? [];

    const readFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setText(await file.text());
        // Lets the same file be chosen again.
        input.value = '';
    };

    return (
        <AppDialog
            {...dialog}
            title="Compare with a report"
            actions={
                <>
                    <Button color="inherit" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disabled={!missing.length}
                        onClick={() => {
                            dispatch(addMissingFromReport(playlistId, missing));
                            onClose();
                        }}
                    >
                        {missing.length
                            ? `Add ${missing.length} missing item${missing.length === 1 ? '' : 's'}`
                            : 'Add missing items'}
                    </Button>
                </>
            }
        >
            <p className={styles.intro}>
                Load a report saved from this app (<code>1: title | artist</code> per line, or <code>1: title</code> in
                older reports) to find the videos this playlist no longer has. Missing items come back in their old
                place, and you can paste each one's YouTube link later.
            </p>
            <div className={styles.file}>
                <Button
                    component="label"
                    variant="contained"
                    color="inherit"
                    size="small"
                    className={styles.choose}
                    startIcon={<FileUploadOutlined />}
                >
                    Choose a .txt file
                    <input className={styles.hidden} type="file" accept=".txt,text/plain" onChange={readFile} />
                </Button>
                <span className={styles.fileName}>{fileName || 'or paste it below'}</span>
            </div>
            <label className={styles.label} htmlFor="report-text">
                Report text
            </label>
            <textarea
                id="report-text"
                className={styles.text}
                rows={5}
                placeholder={EXAMPLE}
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                    setFileName('');
                }}
                spellCheck={false}
            />

            {result === null && (
                <p className={styles.error} role="alert">
                    No numbered lines found. Each video needs a line like "12: title".
                </p>
            )}
            {result && (
                <>
                    <Chip
                        size="small"
                        className={styles.format}
                        label={result.format === FORMATS.artists ? 'Report with artists' : 'Legacy report, no artists'}
                    />
                    <dl className={styles.stats}>
                        <div>
                            <dt>In the report</dt>
                            <dd>{result.total}</dd>
                        </div>
                        <div>
                            <dt>Still here</dt>
                            <dd>{result.found}</dd>
                        </div>
                        <div>
                            <dt>Missing</dt>
                            <dd>{missing.length}</dd>
                        </div>
                    </dl>
                    {missing.length ? (
                        <MissingEntries entries={missing} />
                    ) : (
                        <p>Nothing is missing: every item in the report is still in this playlist.</p>
                    )}
                </>
            )}
        </AppDialog>
    );
};

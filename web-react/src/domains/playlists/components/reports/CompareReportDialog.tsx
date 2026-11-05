import { compareReport, FORMATS, parseReport } from '@ytpm/core/playlists/report-compare';
import { useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { AppDialog } from '../../../ui/components/dialog/AppDialog';
import type { DialogControls } from '../../../ui/components/dialog/useDialog';
import { selectAllVideos } from '../../../videos/videos.selectors';
import { addMissingFromReport } from '../../playlists.thunks';
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
                    <button className="btn btn-ghost" type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        type="button"
                        disabled={!missing.length}
                        onClick={() => {
                            dispatch(addMissingFromReport(playlistId, missing));
                            onClose();
                        }}
                    >
                        {missing.length
                            ? `Add ${missing.length} missing item${missing.length === 1 ? '' : 's'}`
                            : 'Add missing items'}
                    </button>
                </>
            }
        >
            <p className="text-base-content/65 m-0 text-sm">
                Load a report saved from this app (<code>1: title | artist</code> per line, or <code>1: title</code> in
                older reports) to find the videos this playlist no longer has. Missing items come back in their old
                place, and you can paste each one's YouTube link later.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="btn btn-sm">
                    <Icon name="upload" size={16} /> Choose a .txt file
                    <input className="hidden" type="file" accept=".txt,text/plain" onChange={readFile} />
                </label>
                <span className="text-base-content/65 min-w-0 truncate text-sm">{fileName || 'or paste it below'}</span>
            </div>
            <label className="sr-only" htmlFor="report-text">
                Report text
            </label>
            <textarea
                id="report-text"
                className="textarea mt-3 w-full font-mono text-sm"
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
                <p className="text-error mt-3 mb-0 text-sm" role="alert">
                    No numbered lines found. Each video needs a line like "12: title".
                </p>
            )}
            {result && (
                <>
                    <p className="text-base-content/65 mt-3 mb-0 text-sm">
                        <span
                            className={`badge badge-sm badge-soft ${result.format === FORMATS.artists ? 'badge-primary' : ''}`}
                        >
                            {result.format === FORMATS.artists ? 'Report with artists' : 'Legacy report, no artists'}
                        </span>
                    </p>
                    <div className="stats stats-horizontal bg-base-200 mt-2 w-full">
                        <div className="stat px-4 py-2">
                            <div className="stat-title">In the report</div>
                            <div className="stat-value text-2xl">{result.total}</div>
                        </div>
                        <div className="stat px-4 py-2">
                            <div className="stat-title">Still here</div>
                            <div className="stat-value text-2xl">{result.found}</div>
                        </div>
                        <div className="stat px-4 py-2">
                            <div className="stat-title">Missing</div>
                            <div className={`stat-value text-2xl ${missing.length ? 'text-primary' : ''}`}>
                                {missing.length}
                            </div>
                        </div>
                    </div>
                    {missing.length ? (
                        <MissingEntries entries={missing} />
                    ) : (
                        <p className="mt-3 mb-0 text-sm">
                            Nothing is missing: every item in the report is still in this playlist.
                        </p>
                    )}
                </>
            )}
        </AppDialog>
    );
};

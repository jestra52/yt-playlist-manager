import InfoOutlined from '@mui/icons-material/InfoOutlined';
import SyncIcon from '@mui/icons-material/Sync';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import type { Playlist } from '@ytpm/core/playlists/playlists.repository';
import { diffWithYouTube, hasChanges } from '@ytpm/core/playlists/youtube-sync';
import type { YouTubePlaylist } from '@ytpm/core/videos/playlist.client';
import { useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { AppDialog } from '../../../ui/components/dialog/AppDialog';
import type { DialogControls } from '../../../ui/components/dialog/useDialog';
import { selectAllVideos } from '../../../videos/videos.selectors';
import { applyYouTubeSync, linkToYouTube, readLinkedYouTubePlaylist } from '../../playlists.thunks';
import { DiffSection } from './DiffSection';
import { LinkPlaylistForm } from './LinkPlaylistForm';
import styles from './SyncYouTubeDialog.module.scss';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const SyncYouTubeDialog = ({ playlist, ...dialog }: { playlist: Playlist } & DialogControls) => {
    const { onClose } = dialog;
    const [source, setSource] = useState<YouTubePlaylist | null>(null);
    const [reading, setReading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [editingLink, setEditingLink] = useState(false);
    const [includeUnavailable, setIncludeUnavailable] = useState(false);
    const [removeMissing, setRemoveMissing] = useState(false);
    const [saveReport, setSaveReport] = useState(true);
    const [confirmingRemoval, setConfirmingRemoval] = useState(false);
    const all = useAppSelector(selectAllVideos);
    const dispatch = useAppDispatch();

    const linked = playlist.source === 'youtube' && Boolean(playlist.sourceId);
    const diff = useMemo(
        () =>
            source
                ? diffWithYouTube(
                      all.filter((v) => v.playlistId === playlist.id),
                      source,
                      { includeUnavailable },
                  )
                : null,
        [source, all, playlist.id, includeUnavailable],
    );
    const changes = diff ? hasChanges(diff, { removeMissing }) : false;
    const inStep = diff ? !hasChanges(diff, { removeMissing: true }) : false;
    const removing = diff && removeMissing ? diff.removed.length : 0;

    const compare = async () => {
        setReading(true);
        setFailed(false);
        const read = await dispatch(readLinkedYouTubePlaylist(playlist.id));
        setSource(read);
        setFailed(read === null);
        setReading(false);
    };

    const apply = () => {
        if (!diff || !changes) return;
        if (removing && !confirmingRemoval) {
            setConfirmingRemoval(true);
            return;
        }
        dispatch(applyYouTubeSync(playlist.id, diff, { removeMissing, saveReport }));
        onClose();
    };

    return (
        <AppDialog
            {...dialog}
            title="Sync from YouTube"
            actions={
                <>
                    <Button color="inherit" onClick={onClose}>
                        Cancel
                    </Button>
                    {linked && !editingLink && !diff && (
                        <Button variant="contained" startIcon={<SyncIcon />} disabled={reading} onClick={compare}>
                            Compare with YouTube
                        </Button>
                    )}
                    {diff && !editingLink && (
                        <Button
                            variant="contained"
                            color={confirmingRemoval ? 'error' : 'primary'}
                            disabled={!changes}
                            onClick={apply}
                        >
                            {inStep && 'Already in step'}
                            {!inStep && confirmingRemoval && `Remove ${plural(removing, 'video')} and apply`}
                            {!inStep && !confirmingRemoval && 'Apply'}
                        </Button>
                    )}
                </>
            }
        >
            {!linked || editingLink ? (
                <>
                    <p className={styles.intro}>
                        {linked
                            ? 'Paste the YouTube playlist this one should be linked to instead.'
                            : "This playlist isn't linked to a YouTube playlist yet. Paste the one it came from to compare them."}
                    </p>
                    <LinkPlaylistForm
                        playlistId={playlist.id}
                        onLinked={() => {
                            setEditingLink(false);
                            setSource(null);
                        }}
                    />
                    {editingLink && (
                        <Button
                            size="small"
                            color="inherit"
                            className={styles.keep}
                            onClick={() => setEditingLink(false)}
                        >
                            Keep the current link
                        </Button>
                    )}
                </>
            ) : (
                <>
                    <div className={styles.linked}>
                        <span>
                            Linked to{' '}
                            <Link
                                href={`https://www.youtube.com/playlist?list=${playlist.sourceId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {source?.title ? `“${source.title}”` : playlist.sourceId}
                            </Link>
                        </span>
                        <span className={styles.linkActions}>
                            <Button size="small" color="inherit" onClick={() => setEditingLink(true)}>
                                Change
                            </Button>
                            <Button
                                size="small"
                                color="inherit"
                                onClick={() => {
                                    if (dispatch(linkToYouTube(playlist.id, ''))) setSource(null);
                                }}
                            >
                                Unlink
                            </Button>
                        </span>
                    </div>

                    {reading && (
                        <p className={styles.reading}>
                            <CircularProgress size={16} /> Reading the playlist from YouTube…
                        </p>
                    )}
                    {!reading && !diff && (
                        <>
                            <Alert severity="warning" icon={<InfoOutlined fontSize="small" />} className={styles.alert}>
                                <p className={styles.alertTitle}>Syncing makes this playlist follow YouTube.</p>
                                <p className={styles.alertText}>
                                    It can add videos, mark videos deleted on YouTube as Missing, and, if you choose,
                                    remove videos that are no longer in the YouTube playlist, along with their notes and
                                    watched marks. Compare first: nothing changes until you review and apply.
                                </p>
                            </Alert>
                            {failed && <p className={styles.error}>Couldn't read the YouTube playlist. Try again.</p>}
                        </>
                    )}
                    {!reading && diff && (
                        <>
                            {!diff.complete && (
                                <Alert severity="warning" icon={false} className={styles.alert}>
                                    YouTube only returned part of this playlist (set YOUTUBE_API_KEY on the API to read
                                    all of it), so videos removed there can't be detected. New videos can still be
                                    added.
                                </Alert>
                            )}
                            <DiffSection title="New on YouTube" hint="Added in YouTube's order." items={diff.added} />
                            <DiffSection
                                title="Deleted or private on YouTube"
                                hint="Kept, and marked as Missing so you can paste another link."
                                items={diff.nowUnavailable}
                            />
                            {diff.availableAgain.length > 0 && (
                                <DiffSection
                                    title="Back on YouTube"
                                    hint="No longer marked as deleted."
                                    items={diff.availableAgain}
                                />
                            )}
                            {diff.complete && (
                                <DiffSection
                                    title="Removed from the YouTube playlist"
                                    hint="Kept here unless you choose below."
                                    items={diff.removed}
                                />
                            )}
                            <div className={styles.options}>
                                <FormControlLabel
                                    label="Import with deleted videos (as Missing items)"
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={includeUnavailable}
                                            onChange={(e) => setIncludeUnavailable(e.target.checked)}
                                        />
                                    }
                                />
                                {diff.complete && diff.removed.length > 0 && (
                                    <FormControlLabel
                                        label={`Remove the ${plural(diff.removed.length, 'video')} removed on YouTube from this playlist too`}
                                        control={
                                            <Checkbox
                                                size="small"
                                                color="error"
                                                checked={removeMissing}
                                                onChange={(e) => {
                                                    setRemoveMissing(e.target.checked);
                                                    setConfirmingRemoval(false);
                                                }}
                                            />
                                        }
                                    />
                                )}
                                <FormControlLabel
                                    label="Save a report before applying"
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={saveReport}
                                            onChange={(e) => setSaveReport(e.target.checked)}
                                        />
                                    }
                                />
                            </div>
                            {confirmingRemoval && (
                                <p className={styles.error} role="alert">
                                    This removes {plural(removing, 'video')} from this playlist, with their notes and
                                    watched marks. {saveReport ? 'The report saved first still lists them.' : ''}
                                </p>
                            )}
                        </>
                    )}
                </>
            )}
        </AppDialog>
    );
};

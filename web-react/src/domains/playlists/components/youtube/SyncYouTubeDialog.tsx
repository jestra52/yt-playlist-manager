import type { Playlist } from '@ytpm/core/playlists/playlists.repository';
import { diffWithYouTube, hasChanges } from '@ytpm/core/playlists/youtube-sync';
import type { YouTubePlaylist } from '@ytpm/core/videos/playlist.client';
import { useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { AppDialog } from '../../../ui/components/dialog/AppDialog';
import type { DialogControls } from '../../../ui/components/dialog/useDialog';
import { selectAllVideos } from '../../../videos/videos.selectors';
import { applyYouTubeSync, linkToYouTube, readLinkedYouTubePlaylist } from '../../playlists.thunks';
import { DiffSection } from './DiffSection';
import { LinkPlaylistForm } from './LinkPlaylistForm';

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
                    <button className="btn btn-ghost" type="button" onClick={onClose}>
                        Cancel
                    </button>
                    {linked && !editingLink && !diff && (
                        <button className="btn btn-primary" type="button" disabled={reading} onClick={compare}>
                            <Icon name="sync" size={16} /> Compare with YouTube
                        </button>
                    )}
                    {diff && !editingLink && (
                        <button
                            className={`btn ${confirmingRemoval ? 'btn-error' : 'btn-primary'}`}
                            type="button"
                            disabled={!changes}
                            onClick={apply}
                        >
                            {inStep && 'Already in step'}
                            {!inStep && confirmingRemoval && `Remove ${plural(removing, 'video')} and apply`}
                            {!inStep && !confirmingRemoval && 'Apply'}
                        </button>
                    )}
                </>
            }
        >
            {!linked || editingLink ? (
                <>
                    <p className="text-base-content/65 m-0 text-sm">
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
                        <button
                            className="btn btn-ghost btn-sm mt-3"
                            type="button"
                            onClick={() => setEditingLink(false)}
                        >
                            Keep the current link
                        </button>
                    )}
                </>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="min-w-0">
                            Linked to{' '}
                            <a
                                className="link"
                                href={`https://www.youtube.com/playlist?list=${playlist.sourceId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {source?.title ? `“${source.title}”` : playlist.sourceId}
                            </a>
                        </span>
                        <span className="flex gap-1">
                            <button className="btn btn-ghost btn-xs" type="button" onClick={() => setEditingLink(true)}>
                                Change
                            </button>
                            <button
                                className="btn btn-ghost btn-xs"
                                type="button"
                                onClick={() => {
                                    if (dispatch(linkToYouTube(playlist.id, ''))) setSource(null);
                                }}
                            >
                                Unlink
                            </button>
                        </span>
                    </div>

                    {reading && (
                        <p className="text-base-content/65 m-0 flex items-center gap-2 py-6 text-sm">
                            <span className="loading loading-spinner loading-sm" /> Reading the playlist from YouTube…
                        </p>
                    )}
                    {!reading && !diff && (
                        <>
                            <div role="alert" className="alert alert-warning alert-soft mt-4 items-start text-sm">
                                <Icon name="info" size={18} />
                                <div>
                                    <p className="m-0 font-semibold">Syncing makes this playlist follow YouTube.</p>
                                    <p className="mt-1 mb-0">
                                        It can add videos, mark videos deleted on YouTube as Missing, and, if you
                                        choose, remove videos that are no longer in the YouTube playlist, along with
                                        their notes and watched marks. Compare first: nothing changes until you review
                                        and apply.
                                    </p>
                                </div>
                            </div>
                            {failed && (
                                <p className="text-error mt-3 mb-0 text-sm">
                                    Couldn't read the YouTube playlist. Try again.
                                </p>
                            )}
                        </>
                    )}
                    {!reading && diff && (
                        <>
                            {!diff.complete && (
                                <div role="alert" className="alert alert-warning alert-soft mt-3 text-sm">
                                    YouTube only returned part of this playlist (set YOUTUBE_API_KEY on the API to read
                                    all of it), so videos removed there can't be detected. New videos can still be
                                    added.
                                </div>
                            )}
                            <div className="mt-3 space-y-2">
                                <DiffSection
                                    title="New on YouTube"
                                    hint="Added in YouTube's order."
                                    items={diff.added}
                                />
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
                            </div>
                            <div className="mt-4 space-y-2 text-sm">
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-sm"
                                        checked={includeUnavailable}
                                        onChange={(e) => setIncludeUnavailable(e.target.checked)}
                                    />
                                    Import with deleted videos (as Missing items)
                                </label>
                                {diff.complete && diff.removed.length > 0 && (
                                    <label className="flex cursor-pointer items-center gap-2">
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-sm checkbox-error"
                                            checked={removeMissing}
                                            onChange={(e) => {
                                                setRemoveMissing(e.target.checked);
                                                setConfirmingRemoval(false);
                                            }}
                                        />
                                        Remove the {plural(diff.removed.length, 'video')} removed on YouTube from this
                                        playlist too
                                    </label>
                                )}
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-sm"
                                        checked={saveReport}
                                        onChange={(e) => setSaveReport(e.target.checked)}
                                    />
                                    Save a report before applying
                                </label>
                            </div>
                            {confirmingRemoval && (
                                <p className="text-error mt-3 mb-0 text-sm" role="alert">
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

import { parsePlaylistId, videoInPlaylist } from '@ytpm/core/videos/youtube';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { toggleSidebar } from '../../../ui/ui.slice';
import { LinkChoice } from '../../../videos/components/add/LinkChoice';
import { createFromInput } from '../../playlists.thunks';
import styles from './NewPlaylistForm.module.scss';

export const NewPlaylistForm = () => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [wholePlaylist, setWholePlaylist] = useState(true);
    const [withDeleted, setWithDeleted] = useState(false);
    const importing = useAppSelector((state) => state.ui.importing);
    const dispatch = useAppDispatch();

    const fromList = Boolean(videoInPlaylist(name));
    const isLink = Boolean(parsePlaylistId(name)) && (!fromList || wholePlaylist);

    if (!open) {
        return (
            <button
                type="button"
                className={`btn btn-ghost btn-sm mt-2 justify-start ${styles.open}`}
                onClick={() => setOpen(true)}
            >
                <Icon name="plus" size={16} /> New playlist
            </button>
        );
    }

    return (
        <form
            className="mt-2"
            onSubmit={async (event) => {
                event.preventDefault();
                const options = { includeUnavailable: withDeleted, justVideo: fromList && !wholePlaylist };
                if (await dispatch(createFromInput(name, options))) {
                    setName('');
                    setOpen(false);
                    dispatch(toggleSidebar(false));
                }
            }}
        >
            <div className="join w-full">
                <label className="sr-only" htmlFor="new-playlist">
                    Playlist name or YouTube playlist link
                </label>
                <input
                    id="new-playlist"
                    className="input input-sm join-item text-base-content min-w-0 flex-1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
                    maxLength={500}
                    placeholder="Name or YouTube playlist link"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={importing}
                    autoFocus
                />
                <button className="btn btn-primary btn-sm join-item" type="submit" disabled={!name.trim() || importing}>
                    {importing ? (
                        <>
                            <span className="loading loading-spinner loading-xs" />
                            <span className="sr-only">Importing</span>
                        </>
                    ) : (
                        <>{isLink ? 'Import' : 'Create'}</>
                    )}
                </button>
            </div>
            {fromList && (
                <div className="mt-2 px-1">
                    <LinkChoice
                        wholePlaylist={wholePlaylist}
                        onChange={setWholePlaylist}
                        videoLabel="Just this video"
                        playlistLabel="Whole playlist"
                        disabled={importing}
                        size="xs"
                    />
                </div>
            )}
            {isLink && (
                <label className={`mt-2 flex items-center gap-2 px-1 text-sm ${styles.withDeleted}`}>
                    <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={withDeleted}
                        onChange={(e) => setWithDeleted(e.target.checked)}
                        disabled={importing}
                    />
                    Import with deleted videos
                </label>
            )}
        </form>
    );
};

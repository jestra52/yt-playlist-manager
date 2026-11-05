import { parsePlaylistId, videoInPlaylist } from '@ytpm/core/videos/youtube';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { ShowPlaylistsButton } from '../../../ui/components/layout/ShowPlaylistsButton';
import { openSettings } from '../../../ui/ui.slice';
import { LinkChoice } from '../../../videos/components/add/LinkChoice';
import { createFromInput } from '../../playlists.thunks';
import styles from './FirstPlaylist.module.scss';

export const FirstPlaylist = () => {
    const [name, setName] = useState('Watch later');
    const [wholePlaylist, setWholePlaylist] = useState(true);
    const [withDeleted, setWithDeleted] = useState(false);
    const importing = useAppSelector((state) => state.ui.importing);
    const dispatch = useAppDispatch();

    const fromList = Boolean(videoInPlaylist(name));
    const isLink = Boolean(parsePlaylistId(name)) && (!fromList || wholePlaylist);

    return (
        <section className="max-w-xl pt-[12vh]">
            <ShowPlaylistsButton className="mb-4" />
            <h1 className={styles.title}>Start your first playlist</h1>
            <p className="text-base-content/65 m-0">
                Save YouTube videos to watch later, in the order you want, with notes. Everything stays in this browser.
            </p>
            <form
                className="join mt-6 mb-2 w-full"
                onSubmit={(event) => {
                    event.preventDefault();
                    const options = { includeUnavailable: withDeleted, justVideo: fromList && !wholePlaylist };
                    dispatch(createFromInput(name, options));
                }}
            >
                <label className="sr-only" htmlFor="first-name">
                    Playlist name or YouTube playlist link
                </label>
                <input
                    id="first-name"
                    className="input input-lg join-item min-w-0 flex-1 text-base"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={500}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={importing}
                />
                <button
                    className="btn btn-primary btn-lg join-item text-base"
                    type="submit"
                    disabled={!name.trim() || importing}
                >
                    {importing && (
                        <>
                            <span className="loading loading-spinner loading-sm" /> Importing…
                        </>
                    )}
                    {!importing && (isLink ? 'Import playlist' : 'Create playlist')}
                </button>
            </form>
            {fromList && (
                <div className="mb-2">
                    <LinkChoice
                        wholePlaylist={wholePlaylist}
                        onChange={setWholePlaylist}
                        videoLabel="Start with just this video"
                        playlistLabel="Import the whole playlist"
                        disabled={importing}
                    />
                </div>
            )}
            {isLink && (
                <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={withDeleted}
                        onChange={(e) => setWithDeleted(e.target.checked)}
                        disabled={importing}
                    />
                    <span>
                        Import with deleted videos{' '}
                        <span className="text-base-content/65">
                            (added as Missing items, so you can paste another link later)
                        </span>
                    </span>
                </label>
            )}
            <p className="text-base-content/65 mt-0 mb-8 text-sm">
                Type a name, or paste a link to a YouTube playlist to bring in its videos.
            </p>
            <p className="text-base-content/65 m-0 text-sm">
                Already using Yuzu Tapes on another device?{' '}
                <button
                    className="link text-base-content font-semibold"
                    type="button"
                    onClick={() => dispatch(openSettings())}
                >
                    Connect sync
                </button>{' '}
                to bring your playlists here.
            </p>
        </section>
    );
};

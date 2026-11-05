import { listProblem, parsePlaylistId } from '@ytpm/core/videos/youtube';
import { useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { linkToYouTube } from '../../playlists.thunks';

export const LinkPlaylistForm = ({ playlistId, onLinked }: { playlistId: string; onLinked: () => void }) => {
    const [link, setLink] = useState('');
    const dispatch = useAppDispatch();
    const valid = Boolean(parsePlaylistId(link));

    return (
        <>
            <form
                className="join mt-4 w-full"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (dispatch(linkToYouTube(playlistId, link))) onLinked();
                }}
            >
                <label className="sr-only" htmlFor="sync-link">
                    YouTube playlist link or ID
                </label>
                <input
                    id="sync-link"
                    className="input join-item min-w-0 flex-1"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://www.youtube.com/playlist?list=…"
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="url"
                />
                <button className="btn btn-primary join-item" type="submit" disabled={!valid}>
                    Link
                </button>
            </form>
            {link.trim() && !valid && (
                <p className="text-error mt-2 mb-0 text-sm" role="alert">
                    {listProblem(link) ?? "That isn't a YouTube playlist link or ID"}.
                </p>
            )}
        </>
    );
};

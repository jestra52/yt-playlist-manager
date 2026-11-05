import { extractYouTubeIds } from '@ytpm/core/videos/youtube';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { addVideosFromText } from '../../videos.thunks';
import { LinkChoice } from './LinkChoice';

export const AddVideosForm = ({ playlistId }: { playlistId: string }) => {
    const [text, setText] = useState('');
    const [wholePlaylists, setWholePlaylists] = useState(false);
    const importing = useAppSelector((state) => state.ui.importing);
    const dispatch = useAppDispatch();
    const inPlaylist = extractYouTubeIds(text).inPlaylist;

    return (
        <form
            onSubmit={async (event) => {
                event.preventDefault();
                const whole = inPlaylist > 0 && wholePlaylists;
                if (await dispatch(addVideosFromText(playlistId, text, { wholePlaylists: whole }))) {
                    setText('');
                    setWholePlaylists(false);
                }
            }}
        >
            <div className="join w-full">
                <label className="sr-only" htmlFor="add-videos">
                    YouTube video or playlist links
                </label>
                <input
                    id="add-videos"
                    className="input input-lg join-item min-w-0 flex-1 text-base"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste YouTube video or playlist links"
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="url"
                    disabled={importing}
                />
                <button
                    className="btn btn-primary btn-lg join-item text-base"
                    type="submit"
                    disabled={!text.trim() || importing}
                >
                    {importing ? (
                        <>
                            <span className="loading loading-spinner loading-sm" /> Importing…
                        </>
                    ) : (
                        <>
                            <Icon name="plus" size={16} /> Add
                        </>
                    )}
                </button>
            </div>
            {inPlaylist > 0 && (
                <div className="mt-2 px-1">
                    <LinkChoice
                        wholePlaylist={wholePlaylists}
                        onChange={setWholePlaylists}
                        videoLabel={inPlaylist === 1 ? 'Add this video' : 'Add these videos'}
                        playlistLabel={inPlaylist === 1 ? 'Add the whole playlist' : 'Add the whole playlists'}
                        disabled={importing}
                    />
                </div>
            )}
        </form>
    );
};

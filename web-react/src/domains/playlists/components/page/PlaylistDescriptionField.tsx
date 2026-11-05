import type { Playlist } from '@ytpm/core/playlists/playlists.repository';
import { useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { describePlaylist } from '../../playlists.thunks';

export const PlaylistDescriptionField = ({ playlist }: { playlist: Playlist }) => {
    const [description, setDescription] = useState(playlist.description);
    const dispatch = useAppDispatch();

    return (
        <>
            <label className="sr-only" htmlFor="playlist-description">
                Description
            </label>
            <input
                id="playlist-description"
                className="input input-ghost input-sm text-base-content/65 mt-1 -ml-3 w-full"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                    if (description.trim() !== playlist.description) {
                        dispatch(describePlaylist(playlist.id, description));
                    }
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') setDescription(playlist.description);
                }}
                placeholder="Add a description"
                maxLength={500}
                autoComplete="off"
            />
        </>
    );
};

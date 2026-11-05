import type { Playlist } from '@ytpm/core/playlists/playlists.repository';
import { useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { renamePlaylist } from '../../playlists.thunks';
import styles from './PlaylistNameField.module.scss';

export const PlaylistNameField = ({ playlist }: { playlist: Playlist }) => {
    const [name, setName] = useState(playlist.name);
    const dispatch = useAppDispatch();

    const save = () => {
        if (name.trim() && name.trim() !== playlist.name) dispatch(renamePlaylist(playlist.id, name));
        else setName(playlist.name);
    };

    return (
        <>
            <label className="sr-only" htmlFor="playlist-name">
                Playlist name
            </label>
            <input
                id="playlist-name"
                className={`input input-ghost min-w-0 flex-1 ${styles.name}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') setName(playlist.name);
                }}
                maxLength={200}
                autoComplete="off"
                spellCheck={false}
            />
        </>
    );
};

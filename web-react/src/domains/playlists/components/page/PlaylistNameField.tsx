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
        <div className={styles.field}>
            <label className="sr-only" htmlFor="playlist-name">
                Playlist name
            </label>
            <span className={styles.sizer} aria-hidden="true">
                {name}{' '}
            </span>
            <textarea
                id="playlist-name"
                className={`textarea textarea-ghost ${styles.name}`}
                rows={1}
                value={name}
                onChange={(e) => setName(e.target.value.replace(/\s*\n\s*/g, ' '))}
                onBlur={save}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.currentTarget.blur();
                    }
                    if (e.key === 'Escape') setName(playlist.name);
                }}
                maxLength={200}
                autoComplete="off"
                spellCheck={false}
            />
        </div>
    );
};

import LinearProgress from '@mui/material/LinearProgress';
import type { Playlist } from '@ytpm/core/playlists/playlists.repository';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { selectProgressByPlaylist } from '../../../videos/videos.selectors';
import { describePlaylist, renamePlaylist } from '../../playlists.thunks';
import { ReportButtons } from '../reports/ReportButtons';
import { DeletePlaylistButton } from './DeletePlaylistButton';
import styles from './PlaylistHeader.module.scss';

const tally = (left: number, total: number) => {
    if (!total) return 'No videos yet';
    if (!left) return `All ${total} watched`;
    return `${left} left of ${total}`;
};

export const PlaylistHeader = ({ playlist }: { playlist: Playlist }) => {
    const { left, total } = useAppSelector(selectProgressByPlaylist)[playlist.id] ?? { left: 0, total: 0 };
    const [name, setName] = useState(playlist.name);
    const [description, setDescription] = useState(playlist.description);
    const dispatch = useAppDispatch();
    const watched = total ? ((total - left) / total) * 100 : 0;

    const saveName = () => {
        if (name.trim() && name.trim() !== playlist.name) dispatch(renamePlaylist(playlist.id, name));
        else setName(playlist.name);
    };

    const saveDescription = () => {
        if (description.trim() !== playlist.description) dispatch(describePlaylist(playlist.id, description));
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
            setName(playlist.name);
            setDescription(playlist.description);
        }
    };

    return (
        <header>
            <div className={styles.top}>
                <label className={styles.label} htmlFor="playlist-name">
                    Playlist name
                </label>
                <input
                    id="playlist-name"
                    className={styles.name}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={onKeyDown}
                    maxLength={200}
                    autoComplete="off"
                    spellCheck={false}
                />
                <ReportButtons playlistId={playlist.id} />
                <DeletePlaylistButton playlistId={playlist.id} />
            </div>
            <label className={styles.label} htmlFor="playlist-description">
                Description
            </label>
            <input
                id="playlist-description"
                className={styles.description}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={saveDescription}
                onKeyDown={onKeyDown}
                placeholder="Add a description"
                maxLength={500}
                autoComplete="off"
            />
            <div className={styles.progress}>
                <LinearProgress
                    variant="determinate"
                    value={watched}
                    color="success"
                    className={styles.bar}
                    aria-label="Watched"
                />
                <span>{tally(left, total)}</span>
            </div>
        </header>
    );
};

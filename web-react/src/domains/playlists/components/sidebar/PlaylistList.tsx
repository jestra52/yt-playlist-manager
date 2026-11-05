import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { toggleSidebar } from '../../../ui/ui.slice';
import { selectProgressByPlaylist } from '../../../videos/videos.selectors';
import { selectPlaylists, selectSelectedPlaylistId } from '../../playlists.selectors';
import { selectPlaylist } from '../../playlists.thunks';
import styles from './PlaylistList.module.scss';

export const PlaylistList = () => {
    const playlists = useAppSelector(selectPlaylists);
    const selectedId = useAppSelector(selectSelectedPlaylistId);
    const progress = useAppSelector(selectProgressByPlaylist);
    const dispatch = useAppDispatch();

    return (
        <ul className={`menu w-full gap-0.5 p-0 ${styles.list}`}>
            {playlists.map((playlist) => {
                const { left, total } = progress[playlist.id] ?? { left: 0, total: 0 };
                const active = playlist.id === selectedId;
                return (
                    <li key={playlist.id}>
                        <button
                            type="button"
                            className={active ? `${styles.item} ${styles.active}` : styles.item}
                            aria-current={active ? 'page' : undefined}
                            onClick={() => {
                                dispatch(selectPlaylist(playlist.id));
                                dispatch(toggleSidebar(false));
                            }}
                        >
                            <span className={styles.name} title={playlist.name}>
                                {playlist.name}
                            </span>
                            <span className={styles.count} title={`${left} left to watch`}>
                                {left}
                                <span className={styles.of}>/{total}</span>
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
};

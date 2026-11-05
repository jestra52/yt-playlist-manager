import type { Video } from '@ytpm/core/videos/videos.repository';
import { useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { selectPlaylists } from '../../../playlists/playlists.selectors';
import { moveToPlaylist } from '../../videos.thunks';

export const MoveMenu = ({ video }: { video: Video }) => {
    const menuRef = useRef<HTMLDetailsElement>(null);
    const playlists = useAppSelector(selectPlaylists);
    const dispatch = useAppDispatch();
    const others = playlists.filter((p) => p.id !== video.playlistId);

    if (!others.length) return null;
    return (
        <details ref={menuRef} className="dropdown dropdown-end">
            <summary
                className="btn btn-ghost btn-square btn-sm"
                role="button"
                title="Move to another playlist"
                aria-label="Move to playlist"
            >
                <Icon name="move" size={17} />
            </summary>
            <ul className="menu dropdown-content rounded-box bg-base-100 z-10 m-0 w-56 p-2 shadow-lg">
                <li className="menu-title">Move to</li>
                {others.map((playlist) => (
                    <li key={playlist.id}>
                        <button
                            type="button"
                            onClick={() => {
                                if (menuRef.current) menuRef.current.open = false;
                                dispatch(moveToPlaylist(video.id, playlist));
                            }}
                        >
                            {playlist.name}
                        </button>
                    </li>
                ))}
            </ul>
        </details>
    );
};

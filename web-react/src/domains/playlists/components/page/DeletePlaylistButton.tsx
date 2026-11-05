import { useEffect, useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { deletePlaylist } from '../../playlists.thunks';

export const DeletePlaylistButton = ({ playlistId }: { playlistId: string }) => {
    const [confirming, setConfirming] = useState(false);
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (!confirming) return undefined;
        const timer = setTimeout(() => setConfirming(false), 4000);
        return () => clearTimeout(timer);
    }, [confirming]);

    return (
        <button
            type="button"
            className={`btn btn-sm ${confirming ? 'btn-error btn-soft' : 'btn-ghost'}`}
            aria-label={confirming ? 'Confirm deleting this playlist' : 'Delete playlist'}
            onClick={() => {
                if (confirming) dispatch(deletePlaylist(playlistId));
                else setConfirming(true);
            }}
        >
            <Icon name="trash" size={16} />
            <span className={confirming ? '' : 'max-md:hidden'}>
                {confirming ? 'Delete it and its videos' : 'Delete'}
            </span>
        </button>
    );
};

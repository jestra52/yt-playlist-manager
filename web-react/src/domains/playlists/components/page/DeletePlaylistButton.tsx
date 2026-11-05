import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import Button from '@mui/material/Button';
import { useEffect, useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
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
        <Button
            size="small"
            color={confirming ? 'error' : 'inherit'}
            variant={confirming ? 'contained' : 'text'}
            startIcon={<DeleteOutlined />}
            aria-label={confirming ? 'Confirm deleting this playlist' : 'Delete playlist'}
            onClick={() => {
                if (confirming) dispatch(deletePlaylist(playlistId));
                else setConfirming(true);
            }}
        >
            {confirming ? 'Delete it and its videos' : 'Delete'}
        </Button>
    );
};

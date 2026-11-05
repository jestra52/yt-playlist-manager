import DriveFileMoveOutlined from '@mui/icons-material/DriveFileMoveOutlined';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import type { Video } from '@ytpm/core/videos/videos.repository';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { selectPlaylists } from '../../../playlists/playlists.selectors';
import { moveToPlaylist } from '../../videos.thunks';

export const MoveMenu = ({ video }: { video: Video }) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const playlists = useAppSelector(selectPlaylists);
    const dispatch = useAppDispatch();
    const others = playlists.filter((p) => p.id !== video.playlistId);

    if (!others.length) return null;
    return (
        <>
            <IconButton
                size="small"
                title="Move to another playlist"
                aria-label="Move to playlist"
                onClick={(e) => setAnchor(e.currentTarget)}
            >
                <DriveFileMoveOutlined fontSize="small" />
            </IconButton>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
                {others.map((playlist) => (
                    <MenuItem
                        key={playlist.id}
                        onClick={() => {
                            setAnchor(null);
                            dispatch(moveToPlaylist(video.id, playlist));
                        }}
                    >
                        {playlist.name}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};

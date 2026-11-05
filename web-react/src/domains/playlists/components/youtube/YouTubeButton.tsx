import LinkIcon from '@mui/icons-material/Link';
import SyncIcon from '@mui/icons-material/Sync';
import Button from '@mui/material/Button';
import type { Playlist } from '@ytpm/core/playlists/playlists.repository';
import { useDialog } from '../../../ui/components/dialog/useDialog';
import { SyncYouTubeDialog } from './SyncYouTubeDialog';

export const YouTubeButton = ({ playlist }: { playlist: Playlist }) => {
    const dialog = useDialog();
    const linked = playlist.source === 'youtube' && Boolean(playlist.sourceId);

    return (
        <>
            <Button
                size="small"
                color="inherit"
                startIcon={linked ? <SyncIcon /> : <LinkIcon />}
                title={
                    linked
                        ? 'Linked to a YouTube playlist: sync from it'
                        : 'Link to the YouTube playlist this came from'
                }
                aria-label={
                    linked
                        ? 'YouTube playlist: sync from it, or change the link'
                        : 'Link to a YouTube playlist and sync from it'
                }
                onClick={dialog.show}
            >
                YouTube
            </Button>
            {dialog.mounted && <SyncYouTubeDialog playlist={playlist} {...dialog.controls} />}
        </>
    );
};

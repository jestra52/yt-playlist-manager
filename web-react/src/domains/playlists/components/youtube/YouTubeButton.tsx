import type { Playlist } from '@ytpm/core/playlists/playlists.repository';
import { Icon } from '../../../../shared/components/Icon';
import { useDialog } from '../../../ui/components/dialog/useDialog';
import { SyncYouTubeDialog } from './SyncYouTubeDialog';

export const YouTubeButton = ({ playlist }: { playlist: Playlist }) => {
    const dialog = useDialog();
    const linked = playlist.source === 'youtube' && Boolean(playlist.sourceId);

    return (
        <>
            <button
                type="button"
                className="btn btn-ghost btn-sm"
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
                <Icon name={linked ? 'sync' : 'link'} size={16} />
                <span className="max-md:hidden">YouTube</span>
            </button>
            {dialog.mounted && <SyncYouTubeDialog playlist={playlist} {...dialog.controls} />}
        </>
    );
};

import type { Playlist } from '@ytpm/core/playlists/playlists.repository';
import { useAppSelector } from '../../../../app/store';
import { ShowPlaylistsButton } from '../../../ui/components/layout/ShowPlaylistsButton';
import { selectVideoCounts } from '../../../videos/videos.selectors';
import { ReportButtons } from '../reports/ReportButtons';
import { YouTubeButton } from '../youtube/YouTubeButton';
import { DeletePlaylistButton } from './DeletePlaylistButton';
import { PlaylistDescriptionField } from './PlaylistDescriptionField';
import { PlaylistNameField } from './PlaylistNameField';

const videoCount = (total: number) => {
    if (!total) return 'No videos yet';
    return total === 1 ? '1 video' : `${total} videos`;
};

export const PlaylistHeader = ({ playlist }: { playlist: Playlist }) => {
    const total = useAppSelector(selectVideoCounts)[playlist.id] ?? 0;

    return (
        <header className="pb-5">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex max-w-full min-w-0 flex-[0_1_auto] items-center gap-2">
                    <ShowPlaylistsButton />
                    <PlaylistNameField key={playlist.name} playlist={playlist} />
                </div>
                <div className="ml-auto flex flex-none items-center gap-2">
                    <YouTubeButton playlist={playlist} />
                    <ReportButtons playlistId={playlist.id} />
                    <DeletePlaylistButton playlistId={playlist.id} />
                </div>
            </div>
            <PlaylistDescriptionField key={playlist.description} playlist={playlist} />
            <p className="text-base-content/65 mt-4 mb-0 text-sm tabular-nums">{videoCount(total)}</p>
        </header>
    );
};

import type { Playlist } from '@ytpm/core/playlists/playlists.repository';
import { useAppSelector } from '../../../../app/store';
import { ShowPlaylistsButton } from '../../../ui/components/layout/ShowPlaylistsButton';
import { ProgressStrip } from '../../../videos/components/progress/ProgressStrip';
import { selectProgressByPlaylist } from '../../../videos/videos.selectors';
import { ReportButtons } from '../reports/ReportButtons';
import { YouTubeButton } from '../youtube/YouTubeButton';
import { DeletePlaylistButton } from './DeletePlaylistButton';
import { PlaylistDescriptionField } from './PlaylistDescriptionField';
import { PlaylistNameField } from './PlaylistNameField';

const Tally = ({ left, total }: { left: number; total: number }) => {
    if (!total) return 'No videos yet';
    if (!left) return `All ${total} watched`;
    return (
        <>
            <strong className="font-display text-base-content text-lg">{left}</strong> left of {total}
        </>
    );
};

export const PlaylistHeader = ({ playlist }: { playlist: Playlist }) => {
    const { left, total } = useAppSelector(selectProgressByPlaylist)[playlist.id] ?? { left: 0, total: 0 };

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
            <div className="mt-4 flex items-center gap-4">
                <ProgressStrip playlistId={playlist.id} />
                <p className="text-base-content/65 m-0 flex-none text-sm tabular-nums">
                    <Tally left={left} total={total} />
                </p>
            </div>
        </header>
    );
};

import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { useDialog } from '../../../ui/components/dialog/useDialog';
import { selectProgressByPlaylist } from '../../../videos/videos.selectors';
import { downloadReport } from '../../playlists.thunks';
import { CompareReportDialog } from './CompareReportDialog';

export const ReportButtons = ({ playlistId }: { playlistId: string }) => {
    const dialog = useDialog();
    const total = useAppSelector(selectProgressByPlaylist)[playlistId]?.total ?? 0;
    const dispatch = useAppDispatch();

    return (
        <>
            <button
                type="button"
                className="btn btn-ghost btn-sm"
                title="Find videos missing since an old report"
                aria-label="Compare with an old report and add back missing videos"
                onClick={dialog.show}
            >
                <Icon name="upload" size={16} />
                <span className="max-md:hidden">Compare</span>
            </button>
            <button
                type="button"
                className="btn btn-ghost btn-sm"
                title="Download a .txt list of the videos"
                aria-label="Download a report of this playlist's videos"
                disabled={total === 0}
                onClick={() => dispatch(downloadReport(playlistId))}
            >
                <Icon name="download" size={16} />
                <span className="max-md:hidden">Report</span>
            </button>
            {dialog.mounted && <CompareReportDialog playlistId={playlistId} {...dialog.controls} />}
        </>
    );
};

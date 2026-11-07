import { useAppSelector } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { useDialog } from '../../../ui/components/dialog/useDialog';
import { selectVideoCounts } from '../../../videos/videos.selectors';
import { CompareReportDialog } from './CompareReportDialog';
import { ReportMenu } from './ReportMenu';

export const ReportButtons = ({ playlistId }: { playlistId: string }) => {
    const dialog = useDialog();
    const total = useAppSelector(selectVideoCounts)[playlistId] ?? 0;

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
            {total > 0 ? (
                <ReportMenu playlistId={playlistId} />
            ) : (
                <button type="button" className="btn btn-ghost btn-sm" aria-label="Download a report" disabled>
                    <Icon name="download" size={16} />
                    <span className="max-md:hidden">Report</span>
                </button>
            )}
            {dialog.mounted && <CompareReportDialog playlistId={playlistId} {...dialog.controls} />}
        </>
    );
};

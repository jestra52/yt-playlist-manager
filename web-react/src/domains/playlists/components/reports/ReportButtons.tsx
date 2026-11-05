import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlined from '@mui/icons-material/FileUploadOutlined';
import Button from '@mui/material/Button';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
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
            <Button
                size="small"
                color="inherit"
                startIcon={<FileUploadOutlined />}
                title="Find videos missing since an old report"
                aria-label="Compare with an old report and add back missing videos"
                onClick={dialog.show}
            >
                Compare
            </Button>
            <Button
                size="small"
                color="inherit"
                startIcon={<FileDownloadOutlined />}
                title="Download a .txt list of the videos"
                aria-label="Download a report of this playlist's videos"
                disabled={total === 0}
                onClick={() => dispatch(downloadReport(playlistId))}
            >
                Report
            </Button>
            {dialog.mounted && <CompareReportDialog playlistId={playlistId} {...dialog.controls} />}
        </>
    );
};

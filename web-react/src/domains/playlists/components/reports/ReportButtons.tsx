import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlined from '@mui/icons-material/FileUploadOutlined';
import Button from '@mui/material/Button';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { selectProgressByPlaylist } from '../../../videos/videos.selectors';
import { downloadReport } from '../../playlists.thunks';
import { CompareReportDialog } from './CompareReportDialog';

export const ReportButtons = ({ playlistId }: { playlistId: string }) => {
    const [comparing, setComparing] = useState(false);
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
                onClick={() => setComparing(true)}
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
            {comparing && <CompareReportDialog playlistId={playlistId} onClose={() => setComparing(false)} />}
        </>
    );
};

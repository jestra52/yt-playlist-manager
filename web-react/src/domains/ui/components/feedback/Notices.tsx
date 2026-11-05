import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { restoreVideo } from '../../../videos/videos.thunks';
import { dismissNotice } from '../../ui.slice';

export const Notices = () => {
    const notice = useAppSelector((state) => state.ui.notices[0]);
    const dispatch = useAppDispatch();
    if (!notice) return null;

    const close = () => dispatch(dismissNotice(notice.id));
    const { undoVideoId } = notice;
    return (
        <Snackbar key={notice.id} open autoHideDuration={notice.timeout} onClose={close}>
            <Alert
                severity={notice.tone === 'error' ? 'error' : 'info'}
                variant="filled"
                onClose={close}
                action={
                    undoVideoId ? (
                        <Button
                            color="inherit"
                            size="small"
                            onClick={() => {
                                dispatch(restoreVideo(undoVideoId));
                                close();
                            }}
                        >
                            Undo
                        </Button>
                    ) : undefined
                }
            >
                {notice.message}
            </Alert>
        </Snackbar>
    );
};

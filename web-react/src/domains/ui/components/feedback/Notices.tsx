import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import { createPortal } from 'react-dom';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { restoreVideo } from '../../../videos/videos.thunks';
import { dismissNotice } from '../../ui.slice';
import { useTopDialog } from '../dialog/openDialogs';

export const Notices = () => {
    const notice = useAppSelector((state) => state.ui.notices[0]);
    const dispatch = useAppDispatch();
    const dialog = useTopDialog();
    if (!notice) return null;

    const close = () => dispatch(dismissNotice(notice.id));
    const { undoVideoId } = notice;
    const snackbar = (
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
    return dialog ? createPortal(snackbar, dialog) : snackbar;
};

import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { dismissNotice } from '../../ui.slice';

export const Notices = () => {
    const notice = useAppSelector((state) => state.ui.notices[0]);
    const dispatch = useAppDispatch();
    if (!notice) return null;

    const close = () => dispatch(dismissNotice(notice.id));
    return (
        <Snackbar key={notice.id} open autoHideDuration={notice.timeout} onClose={close}>
            <Alert severity={notice.tone === 'error' ? 'error' : 'info'} variant="filled" onClose={close}>
                {notice.message}
            </Alert>
        </Snackbar>
    );
};

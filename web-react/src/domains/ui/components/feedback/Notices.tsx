import { createPortal } from 'react-dom';
import { useAppSelector } from '../../../../app/store';
import { useTopDialog } from '../dialog/openDialogs';
import { NoticeItem } from './NoticeItem';

export const Notices = () => {
    const notices = useAppSelector((state) => state.ui.notices);
    const dialog = useTopDialog();

    const toast = (
        <div className="toast toast-center toast-bottom z-50" aria-live="polite">
            {notices.map((notice) => (
                <NoticeItem key={notice.id} notice={notice} />
            ))}
        </div>
    );
    return dialog ? createPortal(toast, dialog) : toast;
};

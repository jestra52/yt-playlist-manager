import { useEffect } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { restoreVideo } from '../../../videos/videos.thunks';
import { dismissNotice, type Notice } from '../../ui.slice';
import styles from './NoticeItem.module.scss';

export const NoticeItem = ({ notice }: { notice: Notice }) => {
    const dispatch = useAppDispatch();
    const { id, message, tone, timeout, undoVideoId } = notice;

    useEffect(() => {
        if (!timeout) return undefined;
        const timer = setTimeout(() => dispatch(dismissNotice(id)), timeout);
        return () => clearTimeout(timer);
    }, [dispatch, id, timeout]);

    return (
        <div
            role="status"
            className={`alert py-2 pr-2 text-sm shadow-lg ${styles.notice} ${tone === 'error' ? 'alert-error' : styles.info}`}
        >
            <span>{message}</span>
            <div className="flex items-center">
                {undoVideoId && (
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                            dispatch(restoreVideo(undoVideoId));
                            dispatch(dismissNotice(id));
                        }}
                    >
                        Undo
                    </button>
                )}
                <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-square"
                    aria-label="Dismiss"
                    onClick={() => dispatch(dismissNotice(id))}
                >
                    ×
                </button>
            </div>
        </div>
    );
};

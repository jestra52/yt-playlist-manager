import type { Video } from '@ytpm/core/videos/videos.repository';
import { useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { saveNotes } from '../../videos.thunks';
import styles from './VideoNotes.module.scss';

interface VideoNotesProps {
    video: Video;
    editing: boolean;
    onEditingChange: (editing: boolean) => void;
}

export const VideoNotes = ({ video, editing, onEditingChange }: VideoNotesProps) => {
    const [draft, setDraft] = useState(video.notes);
    const dispatch = useAppDispatch();

    const close = () => {
        if (draft !== video.notes) dispatch(saveNotes(video.id, draft.trim()));
        onEditingChange(false);
    };

    if (editing) {
        return (
            <textarea
                className="textarea textarea-sm mt-2 w-full"
                aria-label={`Notes for ${video.title || video.youtubeId}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={close}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                        setDraft(video.notes);
                        onEditingChange(false);
                    }
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) close();
                }}
                rows={3}
                maxLength={5000}
                placeholder="Why you saved it, timestamps, anything"
                autoFocus
            />
        );
    }

    if (!video.notes) return null;
    return (
        <button
            type="button"
            className={styles.notes}
            onClick={() => {
                setDraft(video.notes);
                onEditingChange(true);
            }}
        >
            {video.notes}
        </button>
    );
};

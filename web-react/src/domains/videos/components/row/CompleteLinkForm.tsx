import Button from '@mui/material/Button';
import type { Video } from '@ytpm/core/videos/videos.repository';
import { useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { completeVideo } from '../../videos.thunks';
import styles from './CompleteLinkForm.module.scss';

export const CompleteLinkForm = ({ video, title }: { video: Video; title: string }) => {
    const [link, setLink] = useState('');
    const [saving, setSaving] = useState(false);
    const dispatch = useAppDispatch();

    return (
        <form
            className={styles.form}
            onSubmit={async (event) => {
                event.preventDefault();
                if (!link.trim() || saving) return;
                setSaving(true);
                try {
                    if (await dispatch(completeVideo(video.id, link))) setLink('');
                } finally {
                    setSaving(false);
                }
            }}
        >
            <label className={styles.label} htmlFor={`link-${video.id}`}>
                YouTube link for {title}
            </label>
            <input
                id={`link-${video.id}`}
                className={styles.input}
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder={
                    video.unavailable
                        ? 'Deleted on YouTube: paste another link to replace it'
                        : 'Paste the YouTube link to complete it'
                }
                autoComplete="off"
                spellCheck={false}
                inputMode="url"
                disabled={saving}
            />
            <Button type="submit" variant="contained" size="small" disabled={!link.trim() || saving}>
                Save
            </Button>
        </form>
    );
};

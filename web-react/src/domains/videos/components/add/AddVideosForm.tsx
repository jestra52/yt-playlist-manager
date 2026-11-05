import AddIcon from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import { useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { addVideosFromText, type AddResult } from '../../videos.thunks';
import styles from './AddVideosForm.module.scss';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const describe = ({ added, skipped, invalid }: AddResult): string => {
    const parts: string[] = [];
    if (added) parts.push(`Added ${plural(added, 'video')}`);
    if (skipped) parts.push(`${plural(skipped, 'video')} already in this playlist`);
    if (invalid) parts.push(`${plural(invalid, 'link')} skipped`);
    return parts.join('. ') || "That doesn't look like a YouTube video link";
};

export const AddVideosForm = ({ playlistId }: { playlistId: string }) => {
    const [text, setText] = useState('');
    const [message, setMessage] = useState('');
    const dispatch = useAppDispatch();

    return (
        <form
            className={styles.form}
            onSubmit={(event) => {
                event.preventDefault();
                const result = dispatch(addVideosFromText(playlistId, text));
                setMessage(describe(result));
                if (result.added) setText('');
            }}
        >
            <div className={styles.row}>
                <label className={styles.label} htmlFor="add-videos">
                    YouTube video links
                </label>
                <input
                    id="add-videos"
                    className={styles.input}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste YouTube video links"
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="url"
                />
                <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={!text.trim()}>
                    Add
                </Button>
            </div>
            {message && (
                <p className={styles.message} role="status">
                    {message}
                </p>
            )}
        </form>
    );
};

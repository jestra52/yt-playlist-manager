import InfoOutlined from '@mui/icons-material/InfoOutlined';
import type { Video } from '@ytpm/core/videos/videos.repository';
import { useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { saveArtist } from '../../videos.thunks';
import styles from './ArtistLine.module.scss';

// "Anri - Topic" adds nothing next to the artist "Anri".
const channelName = (author: string) =>
    author
        .replace(/\s+-\s+Topic$/u, '')
        .trim()
        .toLowerCase();

export const ArtistLine = ({ video, title }: { video: Video; title: string }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const dispatch = useAppDispatch();

    const open = () => {
        setDraft(video.artist);
        setEditing(true);
    };

    const close = () => {
        if (!editing) return;
        setEditing(false);
        if (draft.trim() !== video.artist) dispatch(saveArtist(video.id, draft));
    };

    if (editing) {
        return (
            <p className={styles.line}>
                <label className={styles.label} htmlFor={`artist-${video.id}`}>
                    Artist of {title}
                </label>
                <input
                    id={`artist-${video.id}`}
                    className={styles.input}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={close}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditing(false);
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            close();
                        }
                    }}
                    list="known-artists"
                    maxLength={200}
                    placeholder="Artist"
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                />
            </p>
        );
    }

    if (!video.artist) {
        return (
            <p className={styles.line}>
                {video.author && <span>{video.author} · </span>}
                <button type="button" className={styles.add} onClick={open}>
                    Add artist
                </button>
            </p>
        );
    }

    const showChannel = Boolean(video.author) && channelName(video.author) !== video.artist.toLowerCase();
    return (
        <p className={styles.line}>
            <button type="button" className={styles.artist} title="Edit the artist" onClick={open}>
                {video.artist}
            </button>
            {video.artistSource === 'guess' && (
                <button
                    type="button"
                    className={styles.guessed}
                    title="Guessed from the YouTube title or channel, so it may be wrong. Click to correct it."
                    aria-label="Artist guessed from YouTube, may be wrong. Correct it"
                    onClick={open}
                >
                    <InfoOutlined fontSize="inherit" />
                </button>
            )}
            {showChannel && <span> · uploaded by {video.author}</span>}
        </p>
    );
};

import type { Video } from '@ytpm/core/videos/videos.repository';
import { useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
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
            <p className={`text-base-content/65 text-sm ${styles.byline}`}>
                <label className="sr-only" htmlFor={`artist-${video.id}`}>
                    Artist of {title}
                </label>
                <input
                    id={`artist-${video.id}`}
                    className="input input-xs w-full max-w-xs text-sm"
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
            <p className={`text-base-content/65 text-sm ${styles.byline}`}>
                {video.author && (
                    <>
                        {video.author}
                        <span className={styles.separator} aria-hidden="true">
                            ·
                        </span>
                    </>
                )}
                <button type="button" className={styles.add} onClick={open}>
                    Add artist
                </button>
            </p>
        );
    }

    const showChannel = Boolean(video.author) && channelName(video.author) !== video.artist.toLowerCase();
    return (
        <p className={`text-base-content/65 text-sm ${styles.byline}`}>
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
                    <Icon name="info" size={13} />
                </button>
            )}
            {showChannel && (
                <>
                    <span className={styles.separator} aria-hidden="true">
                        ·
                    </span>
                    uploaded by {video.author}
                </>
            )}
        </p>
    );
};

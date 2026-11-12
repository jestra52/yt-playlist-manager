import type { ArtistCredit } from '@ytpm/core/videos/artist-credits';
import type { Video } from '@ytpm/core/videos/videos.repository';
import { Fragment } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { querySet } from '../../videos.slice';
import styles from './ArtistLine.module.scss';

// "Anri - Topic" adds nothing next to the artist "Anri".
const channelName = (author: string) =>
    author
        .replace(/\s+-\s+Topic$/u, '')
        .trim()
        .toLowerCase();

const joiner = (credits: readonly ArtistCredit[], i: number) => {
    if (i === 0) return '';
    return credits[i]!.role === 'featured' && credits[i - 1]!.role === 'main' ? ' feat. ' : ' & ';
};

export const ArtistLine = ({ video, title, onEdit }: { video: Video; title: string; onEdit: () => void }) => {
    const dispatch = useAppDispatch();

    if (!video.artists.length) {
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
                <button type="button" className={styles.add} onClick={onEdit}>
                    Add artist
                </button>
            </p>
        );
    }

    const channel = channelName(video.author);
    const showChannel = Boolean(channel) && !video.artists.some(({ name }) => name.toLowerCase() === channel);
    return (
        <p className={`text-base-content/65 text-sm ${styles.byline}`}>
            {video.artists.map((credit, i) => (
                <Fragment key={credit.name}>
                    {joiner(video.artists, i)}
                    <button
                        type="button"
                        className={styles.artist}
                        title={`Show videos with ${credit.name}`}
                        onClick={() => dispatch(querySet(credit.name))}
                    >
                        {credit.name}
                    </button>
                </Fragment>
            ))}
            {video.artistSource === 'guess' ? (
                <button
                    type="button"
                    className={styles.guessed}
                    title="Guessed from the YouTube title or channel, so it may be wrong. Click to correct it."
                    aria-label="Artist guessed from YouTube, may be wrong. Correct it"
                    onClick={onEdit}
                >
                    <Icon name="info" size={13} />
                </button>
            ) : (
                <button
                    type="button"
                    className={styles.edit}
                    title="Edit the artists"
                    aria-label={`Edit the artists of ${title}`}
                    onClick={onEdit}
                >
                    <Icon name="edit" size={13} />
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

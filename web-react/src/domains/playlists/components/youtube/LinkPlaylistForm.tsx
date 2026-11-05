import Button from '@mui/material/Button';
import { listProblem, parsePlaylistId } from '@ytpm/core/videos/youtube';
import { useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { linkToYouTube } from '../../playlists.thunks';
import styles from './LinkPlaylistForm.module.scss';

export const LinkPlaylistForm = ({ playlistId, onLinked }: { playlistId: string; onLinked: () => void }) => {
    const [link, setLink] = useState('');
    const dispatch = useAppDispatch();
    const valid = Boolean(parsePlaylistId(link));

    return (
        <>
            <form
                className={styles.form}
                onSubmit={(event) => {
                    event.preventDefault();
                    if (dispatch(linkToYouTube(playlistId, link))) onLinked();
                }}
            >
                <label className={styles.label} htmlFor="sync-link">
                    YouTube playlist link or ID
                </label>
                <input
                    id="sync-link"
                    className={styles.input}
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://www.youtube.com/playlist?list=…"
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="url"
                />
                <Button type="submit" variant="contained" className={styles.submit} disabled={!valid}>
                    Link
                </Button>
            </form>
            {link.trim() && !valid && (
                <p className={styles.error} role="alert">
                    {listProblem(link) ?? "That isn't a YouTube playlist link or ID"}.
                </p>
            )}
        </>
    );
};

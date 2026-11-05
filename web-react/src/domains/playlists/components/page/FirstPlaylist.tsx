import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { parsePlaylistId, videoInPlaylist } from '@ytpm/core/videos/youtube';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { openSettings } from '../../../ui/ui.slice';
import { LinkChoice } from '../../../videos/components/add/LinkChoice';
import { createFromInput } from '../../playlists.thunks';
import styles from './FirstPlaylist.module.scss';

export const FirstPlaylist = () => {
    const [name, setName] = useState('Watch later');
    const [wholePlaylist, setWholePlaylist] = useState(true);
    const [withDeleted, setWithDeleted] = useState(false);
    const importing = useAppSelector((state) => state.ui.importing);
    const dispatch = useAppDispatch();

    const fromList = Boolean(videoInPlaylist(name));
    const isLink = Boolean(parsePlaylistId(name)) && (!fromList || wholePlaylist);

    return (
        <section className={styles.first}>
            <Typography variant="h3" component="h1">
                Start your first playlist
            </Typography>
            <p className={styles.muted}>
                Save YouTube videos to watch later, in the order you want, with notes. Everything stays in this browser.
            </p>
            <form
                className={styles.form}
                onSubmit={(event) => {
                    event.preventDefault();
                    const options = { includeUnavailable: withDeleted, justVideo: fromList && !wholePlaylist };
                    dispatch(createFromInput(name, options));
                }}
            >
                <label className={styles.label} htmlFor="first-name">
                    Playlist name or YouTube playlist link
                </label>
                <input
                    id="first-name"
                    className={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={500}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={importing}
                />
                <Button
                    type="submit"
                    variant="contained"
                    className={styles.submit}
                    disabled={!name.trim() || importing}
                    startIcon={importing ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                    {importing && 'Importing…'}
                    {!importing && (isLink ? 'Import playlist' : 'Create playlist')}
                </Button>
            </form>
            {fromList && (
                <LinkChoice
                    wholePlaylist={wholePlaylist}
                    onChange={setWholePlaylist}
                    videoLabel="Start with just this video"
                    playlistLabel="Import the whole playlist"
                    disabled={importing}
                />
            )}
            {isLink && (
                <FormControlLabel
                    className={styles.deleted}
                    disabled={importing}
                    label="Import with deleted videos (added as Missing items, so you can paste another link later)"
                    control={
                        <Checkbox
                            size="small"
                            checked={withDeleted}
                            onChange={(e) => setWithDeleted(e.target.checked)}
                        />
                    }
                />
            )}
            <p className={styles.hint}>Type a name, or paste a link to a YouTube playlist to bring in its videos.</p>
            <p className={styles.hint}>
                Already using Yuzu Tapes on another device?{' '}
                <Link component="button" type="button" color="inherit" onClick={() => dispatch(openSettings())}>
                    Connect sync
                </Link>{' '}
                to bring your playlists here.
            </p>
        </section>
    );
};

import AddIcon from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import { extractYouTubeIds } from '@ytpm/core/videos/youtube';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { addVideosFromText } from '../../videos.thunks';
import styles from './AddVideosForm.module.scss';
import { LinkChoice } from './LinkChoice';

export const AddVideosForm = ({ playlistId }: { playlistId: string }) => {
    const [text, setText] = useState('');
    const [wholePlaylists, setWholePlaylists] = useState(false);
    const importing = useAppSelector((state) => state.ui.importing);
    const dispatch = useAppDispatch();
    const inPlaylist = extractYouTubeIds(text).inPlaylist;

    return (
        <form
            className={styles.form}
            onSubmit={async (event) => {
                event.preventDefault();
                const whole = inPlaylist > 0 && wholePlaylists;
                if (await dispatch(addVideosFromText(playlistId, text, { wholePlaylists: whole }))) {
                    setText('');
                    setWholePlaylists(false);
                }
            }}
        >
            <div className={styles.row}>
                <label className={styles.label} htmlFor="add-videos">
                    YouTube video or playlist links
                </label>
                <input
                    id="add-videos"
                    className={styles.input}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste YouTube video or playlist links"
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="url"
                    disabled={importing}
                />
                <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={!text.trim() || importing}>
                    {importing ? 'Importing...' : 'Add'}
                </Button>
            </div>
            {inPlaylist > 0 && (
                <div className="mt-1">
                    <LinkChoice
                        wholePlaylist={wholePlaylists}
                        onChange={setWholePlaylists}
                        videoLabel={inPlaylist === 1 ? 'Add this video' : 'Add these videos'}
                        playlistLabel={inPlaylist === 1 ? 'Add the whole playlist' : 'Add the whole playlists'}
                        disabled={importing}
                    />
                </div>
            )}
        </form>
    );
};

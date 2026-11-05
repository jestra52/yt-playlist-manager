import AddIcon from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { parsePlaylistId, videoInPlaylist } from '@ytpm/core/videos/youtube';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { toggleSidebar } from '../../../ui/ui.slice';
import { LinkChoice } from '../../../videos/components/add/LinkChoice';
import { createFromInput } from '../../playlists.thunks';
import styles from './NewPlaylistForm.module.scss';

export const NewPlaylistForm = () => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [wholePlaylist, setWholePlaylist] = useState(true);
    const [withDeleted, setWithDeleted] = useState(false);
    const importing = useAppSelector((state) => state.ui.importing);
    const dispatch = useAppDispatch();

    const fromList = Boolean(videoInPlaylist(name));
    const isLink = Boolean(parsePlaylistId(name)) && (!fromList || wholePlaylist);

    if (!open) {
        return (
            <Button className={styles.open} startIcon={<AddIcon />} onClick={() => setOpen(true)}>
                New playlist
            </Button>
        );
    }

    return (
        <form
            className={styles.form}
            onSubmit={async (event) => {
                event.preventDefault();
                const options = { includeUnavailable: withDeleted, justVideo: fromList && !wholePlaylist };
                if (await dispatch(createFromInput(name, options))) {
                    setName('');
                    setOpen(false);
                    dispatch(toggleSidebar(false));
                }
            }}
        >
            <div className={styles.row}>
                <label className={styles.label} htmlFor="new-playlist">
                    Playlist name or YouTube playlist link
                </label>
                <input
                    id="new-playlist"
                    className={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
                    maxLength={500}
                    placeholder="Name or YouTube playlist link"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={importing}
                    autoFocus
                />
                <Button type="submit" variant="contained" size="small" disabled={!name.trim() || importing}>
                    {isLink ? 'Import' : 'Create'}
                </Button>
            </div>
            {fromList && (
                <LinkChoice
                    wholePlaylist={wholePlaylist}
                    onChange={setWholePlaylist}
                    videoLabel="Just this video"
                    playlistLabel="Whole playlist"
                    disabled={importing}
                />
            )}
            {isLink && (
                <FormControlLabel
                    className={styles.withDeleted}
                    label="Import with deleted videos"
                    disabled={importing}
                    control={
                        <Checkbox
                            size="small"
                            checked={withDeleted}
                            onChange={(e) => setWithDeleted(e.target.checked)}
                        />
                    }
                />
            )}
        </form>
    );
};

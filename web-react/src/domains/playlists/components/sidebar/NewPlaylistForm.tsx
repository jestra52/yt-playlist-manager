import AddIcon from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import { useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { toggleSidebar } from '../../../ui/ui.slice';
import { createPlaylist } from '../../playlists.thunks';
import styles from './NewPlaylistForm.module.scss';

export const NewPlaylistForm = () => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const dispatch = useAppDispatch();

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
            onSubmit={(event) => {
                event.preventDefault();
                if (dispatch(createPlaylist(name))) {
                    setName('');
                    setOpen(false);
                    dispatch(toggleSidebar(false));
                }
            }}
        >
            <label className={styles.label} htmlFor="new-playlist">
                Playlist name
            </label>
            <input
                id="new-playlist"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
                maxLength={200}
                placeholder="Name"
                autoComplete="off"
                autoFocus
            />
            <Button type="submit" variant="contained" size="small" disabled={!name.trim()}>
                Create
            </Button>
        </form>
    );
};

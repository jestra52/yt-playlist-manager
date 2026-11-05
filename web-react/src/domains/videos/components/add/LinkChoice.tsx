import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import styles from './LinkChoice.module.scss';

interface LinkChoiceProps {
    wholePlaylist: boolean;
    onChange: (wholePlaylist: boolean) => void;
    videoLabel: string;
    playlistLabel: string;
    disabled?: boolean;
}

export const LinkChoice = ({ wholePlaylist, onChange, videoLabel, playlistLabel, disabled }: LinkChoiceProps) => (
    <div className={styles.choice}>
        <span id="link-choice" className={styles.prompt}>
            This link is from a playlist:
        </span>
        <RadioGroup
            row
            aria-labelledby="link-choice"
            value={wholePlaylist ? 'playlist' : 'video'}
            onChange={(e) => onChange(e.target.value === 'playlist')}
        >
            <FormControlLabel value="video" label={videoLabel} disabled={disabled} control={<Radio size="small" />} />
            <FormControlLabel
                value="playlist"
                label={playlistLabel}
                disabled={disabled}
                control={<Radio size="small" />}
            />
        </RadioGroup>
    </div>
);

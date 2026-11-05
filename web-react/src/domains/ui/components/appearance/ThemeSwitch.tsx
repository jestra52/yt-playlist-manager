import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import DesktopWindowsOutlined from '@mui/icons-material/DesktopWindowsOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { setTheme, type ThemeChoice } from '../../ui.slice';
import styles from './ThemeSwitch.module.scss';

const CHOICES: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
    { value: 'system', label: 'Match the system', icon: <DesktopWindowsOutlined fontSize="small" /> },
    { value: 'light', label: 'Light', icon: <LightModeOutlined fontSize="small" /> },
    { value: 'dark', label: 'Dark', icon: <DarkModeOutlined fontSize="small" /> },
];

export const ThemeSwitch = () => {
    const theme = useAppSelector((state) => state.ui.theme);
    const dispatch = useAppDispatch();

    return (
        <ToggleButtonGroup
            size="small"
            exclusive
            value={theme}
            onChange={(_, value: ThemeChoice | null) => value && dispatch(setTheme(value))}
            aria-label="Appearance"
            className={styles.group}
        >
            {CHOICES.map(({ value, label, icon }) => (
                <ToggleButton key={value} value={value} aria-label={label} title={label}>
                    {icon}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
};

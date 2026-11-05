import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { Icon, type IconName } from '../../../../shared/components/Icon';
import { setTheme, type ThemeChoice } from '../../ui.slice';
import styles from './ThemeSwitch.module.scss';

const CHOICES: { value: ThemeChoice; label: string; icon: IconName }[] = [
    { value: 'system', label: 'Match system', icon: 'monitor' },
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
];

export const ThemeSwitch = () => {
    const theme = useAppSelector((state) => state.ui.theme);
    const dispatch = useAppDispatch();

    return (
        <div className="join" role="radiogroup" aria-label="Appearance">
            {CHOICES.map(({ value, label, icon }) => (
                <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={theme === value}
                    aria-label={label}
                    title={label}
                    className={`btn btn-xs btn-square join-item ${styles.choice}`}
                    onClick={() => dispatch(setTheme(value))}
                >
                    <Icon name={icon} size={14} />
                </button>
            ))}
        </div>
    );
};

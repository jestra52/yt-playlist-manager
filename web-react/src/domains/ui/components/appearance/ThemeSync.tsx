import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { savedTheme, setTheme, THEME_KEY, type ThemeChoice } from '../../ui.slice';

const DARK = '(prefers-color-scheme: dark)';

const apply = (theme: ThemeChoice) => {
    const dark = theme === 'dark' || (theme === 'system' && matchMedia(DARK).matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
};

/** Applies the store's theme, and follows the system and a choice made in another tab. */
export const ThemeSync = () => {
    const theme = useAppSelector((state) => state.ui.theme);
    const dispatch = useAppDispatch();

    useEffect(() => {
        apply(theme);
        if (theme !== 'system') return undefined;
        const media = matchMedia(DARK);
        const follow = () => apply(theme);
        media.addEventListener('change', follow);
        return () => media.removeEventListener('change', follow);
    }, [theme]);

    useEffect(() => {
        const onStorage = ({ key }: StorageEvent) => {
            if (key === THEME_KEY || key === null) dispatch(setTheme(savedTheme()));
        };
        addEventListener('storage', onStorage);
        return () => removeEventListener('storage', onStorage);
    }, [dispatch]);

    return null;
};

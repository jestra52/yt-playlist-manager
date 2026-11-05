import { useColorScheme } from '@mui/material/styles';
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { savedTheme, setTheme, THEME_KEY } from '../../ui.slice';

/** Applies the store's theme, and follows a choice made in another tab. */
export const ThemeSync = () => {
    const theme = useAppSelector((state) => state.ui.theme);
    const dispatch = useAppDispatch();
    const { setMode } = useColorScheme();

    useEffect(() => {
        setMode(theme);
    }, [theme, setMode]);

    useEffect(() => {
        const onStorage = ({ key }: StorageEvent) => {
            if (key === THEME_KEY || key === null) dispatch(setTheme(savedTheme()));
        };
        addEventListener('storage', onStorage);
        return () => removeEventListener('storage', onStorage);
    }, [dispatch]);

    return null;
};

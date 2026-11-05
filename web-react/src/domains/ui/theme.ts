import { createTheme } from '@mui/material/styles';

const display = '"Bricolage Grotesque", "Figtree", system-ui, sans-serif';

export const theme = createTheme({
    cssVariables: { colorSchemeSelector: 'data-theme' },
    colorSchemes: {
        light: {
            palette: {
                primary: { main: '#e5322d', contrastText: '#ffffff' },
                secondary: { main: '#3d6fd6', contrastText: '#ffffff' },
                success: { main: '#2f7d6d', contrastText: '#ffffff' },
                error: { main: '#d0312c', contrastText: '#ffffff' },
                background: { default: '#e9edf2', paper: '#f7f9fb' },
                text: { primary: '#16213a' },
                divider: '#cdd5e0',
            },
        },
        dark: {
            palette: {
                primary: { main: '#ff5a4f', contrastText: '#1a0503' },
                secondary: { main: '#7aa2ff', contrastText: '#0a1330' },
                success: { main: '#4fb59d', contrastText: '#06201a' },
                error: { main: '#ff6b61', contrastText: '#1a0503' },
                background: { default: '#0f1626', paper: '#172036' },
                text: { primary: '#e7ecf5' },
                divider: '#2a3654',
            },
        },
    },
    shape: { borderRadius: 10 },
    typography: {
        fontFamily: '"Figtree", system-ui, sans-serif',
        h1: { fontFamily: display, fontWeight: 800, letterSpacing: '-0.025em' },
        h2: { fontFamily: display, fontWeight: 800, letterSpacing: '-0.025em' },
        h3: { fontFamily: display, fontWeight: 800, letterSpacing: '-0.025em' },
        h4: { fontFamily: display, fontWeight: 800, letterSpacing: '-0.025em' },
        h5: { fontFamily: display, fontWeight: 700 },
        h6: { fontFamily: display, fontWeight: 700 },
        button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
        MuiButton: { defaultProps: { disableElevation: true } },
    },
});

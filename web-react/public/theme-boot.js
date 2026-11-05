// Runs before the first paint, so a reload never flashes the wrong theme.
try {
    const saved = localStorage.getItem('ytpm:theme');
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', saved ?? (dark ? 'dark' : 'light'));
} catch {
    // Storage can be blocked; the CSS in index.html still follows the system.
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "just now", "5 minutes ago", "yesterday"… */
export function timeAgo(ms, nowMs = Date.now()) {
    if (!ms) return 'never';
    const seconds = Math.round((ms - nowMs) / 1000);
    if (Math.abs(seconds) < 45) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
    return rtf.format(Math.round(hours / 24), 'day');
}

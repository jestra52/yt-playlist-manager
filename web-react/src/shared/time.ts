const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "just now", "5 minutes ago", "yesterday"... */
export const timeAgo = (ms: number | null, nowMs = Date.now()): string => {
    if (!ms) return 'never';
    const seconds = Math.round((ms - nowMs) / 1000);
    if (Math.abs(seconds) < 45) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
    return relative.format(Math.round(hours / 24), 'day');
};

<script>
    /** Small stroke icons, drawn on a 24px grid. */
    let { name, size = 18 } = $props();

    const paths = {
        play: 'M8 5.5v13l10.5-6.5z',
        check: 'M5 12.5l4.5 4.5L19 7.5',
        up: 'M12 19V5M6 11l6-6 6 6',
        down: 'M12 5v14M6 13l6 6 6-6',
        trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12.5h10L18 7M9 7V4.5h6V7',
        note: 'M5 4.5h14v11l-4.5 4.5H5zM14.5 20v-4.5H19',
        plus: 'M12 5v14M5 12h14',
        sync: 'M4.5 12a7.5 7.5 0 0 1 13-5.1L19.5 9M19.5 4.5V9H15M19.5 12a7.5 7.5 0 0 1-13 5.1L4.5 15M4.5 19.5V15H9',
        settings:
            'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2 1.2L14.8 20.5h-4l-.3-1.9a7 7 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2.4L4.6 9.9l2-3.4 1.9.7a7 7 0 0 1 2-1.2l.3-1.9h4l.3 1.9a7 7 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2.4z',
        close: 'M6 6l12 12M18 6L6 18',
        menu: 'M4 7h16M4 12h16M4 17h16',
        external: 'M14 4.5h5.5V10M19.5 4.5L11 13M17 14v5.5H4.5V7H10',
        search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM20 20l-4.8-4.8',
        move: 'M4 12h12M12 6l6 6-6 6M20 5v14',
        next: 'M6 5.5v13l9-6.5zM16.5 5h2v14h-2z',
        download: 'M12 4v11M7 10.5l5 5 5-5M5 19.5h14',
        upload: 'M12 15.5v-11M7 9.5l5-5 5 5M5 19.5h14',
        link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2',
        sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M6.7 6.7 5.3 5.3M18.7 18.7l-1.4-1.4M6.7 17.3l-1.4 1.4M18.7 5.3l-1.4 1.4',
        moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
        monitor: 'M3.5 5h17v11h-17zM9 20h6M12 16v4',
    };
    const filled = new Set(['play', 'next']);
</script>

<svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill={filled.has(name) ? 'currentColor' : 'none'}
    stroke="currentColor"
    stroke-width={filled.has(name) ? 0 : 1.8}
    stroke-linecap="round"
    stroke-linejoin="round"
>
    <path d={paths[name]} />
</svg>

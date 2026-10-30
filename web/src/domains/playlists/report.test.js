import { describe, it, expect } from 'vitest';
import { buildPlaylistReport, reportFileName, slugify } from './report.js';

describe('buildPlaylistReport', () => {
    it('lists the total and every video in order, with CRLF line endings', () => {
        const report = buildPlaylistReport([
            { youtubeId: 'dQw4w9WgXcQ', title: '竹内まりや -  Plastic Love (Official Music Video)' },
            { youtubeId: '9bZkp7q19f0', title: 'Anri - Windy Summer' },
        ]);
        expect(report).toBe(
            'Total videos: 2\r\n1: 竹内まりや -  Plastic Love (Official Music Video)\r\n2: Anri - Windy Summer',
        );
    });

    it('uses the link for videos without a title and keeps each video on one line', () => {
        const report = buildPlaylistReport([
            { youtubeId: 'dQw4w9WgXcQ', title: '' },
            { youtubeId: '9bZkp7q19f0', title: 'Two\nlines' },
        ]);
        expect(report.split('\r\n')).toEqual(['Total videos: 2', '1: https://youtu.be/dQw4w9WgXcQ', '2: Two lines']);
    });

    it('handles an empty playlist', () => {
        expect(buildPlaylistReport([])).toBe('Total videos: 0');
    });
});

describe('slugify', () => {
    it.each([
        ['City Pop', 'city-pop'],
        ['  Road trip: 2026!  ', 'road-trip-2026'],
        ['Café Música', 'cafe-musica'],
        ['Ｄｏｗｎ Ｔｏｗｎ', 'down-town'],
        ['シティ・ポップ', 'シティ-ポップ'],
        ['a/b\\c:d*e?f"g<h>i|j', 'a-b-c-d-e-f-g-h-i-j'],
        ['!!!', 'playlist'],
        ['', 'playlist'],
    ])('%s → %s', (name, slug) => {
        expect(slugify(name)).toBe(slug);
    });

    it('keeps names short', () => {
        expect(slugify('word '.repeat(40)).length).toBeLessThanOrEqual(60);
        expect(slugify('word '.repeat(40))).not.toMatch(/-$/);
    });
});

describe('reportFileName', () => {
    it('follows name-report-YYYY-MM-DD__HH-mm-ss.txt in local time', () => {
        expect(reportFileName('City Pop', new Date(2023, 5, 6, 0, 52, 33))).toBe(
            'city-pop-report-2023-06-06__00-52-33.txt',
        );
    });
});

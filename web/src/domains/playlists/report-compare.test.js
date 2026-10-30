import { describe, it, expect } from 'vitest';
import { compareReport, parseReport, titleKey } from './report-compare.js';
import { buildPlaylistReport } from './report.js';

describe('parseReport', () => {
    it('reads numbered lines and skips the total, blank lines and a BOM', () => {
        const text =
            '\uFEFFTotal videos: 3\r\n1: Anri - Windy Summer\r\n\r\n2:   4:00 A.M.  \r\n3: https://youtu.be/dQw4w9WgXcQ';
        expect(parseReport(text)).toEqual([
            { number: 1, title: 'Anri - Windy Summer', youtubeId: null },
            { number: 2, title: '4:00 A.M.', youtubeId: null },
            { number: 3, title: 'https://youtu.be/dQw4w9WgXcQ', youtubeId: 'dQw4w9WgXcQ' },
        ]);
    });

    it('reads what buildPlaylistReport writes', () => {
        const videos = [
            { youtubeId: 'dQw4w9WgXcQ', title: '竹内まりや - Plastic Love' },
            { youtubeId: '9bZkp7q19f0', title: '' },
        ];
        expect(parseReport(buildPlaylistReport(videos)).map((e) => e.youtubeId ?? e.title)).toEqual([
            '竹内まりや - Plastic Love',
            '9bZkp7q19f0',
        ]);
    });

    it('returns nothing for text without numbered lines', () => {
        expect(parseReport('just some notes\nTotal videos: 0')).toEqual([]);
    });
});

describe('titleKey', () => {
    it('ignores case, spacing, punctuation and full-width letters', () => {
        expect(titleKey('MAKOTO MATUSHITA\u3000FIRST LIGHT')).toBe(titleKey('Makoto Matushita - First Light'));
        expect(titleKey('Ｄｏｗｎ Ｔｏｗｎ Ｇｉｒｌ / 彩恵津子')).toBe(titleKey('Down Town Girl 彩恵津子'));
        expect(titleKey('Anri - Windy Summer')).not.toBe(titleKey('Anri - Last Summer Whisper'));
    });
});

describe('compareReport', () => {
    const video = (id, title, youtubeId = `${id}`.padEnd(11, 'x')) => ({ id, title, youtubeId });

    it('finds missing entries and the video each one followed', () => {
        const entries = parseReport('1: One\n2: Two\n3: Three\n4: Four\n5: Five');
        const result = compareReport(entries, [video('a', 'one'), video('c', 'THREE'), video('e', 'Five')]);
        expect(result).toMatchObject({ total: 5, found: 3 });
        expect(result.missing).toEqual([
            { number: 2, title: 'Two', youtubeId: null, afterId: 'a' },
            { number: 4, title: 'Four', youtubeId: null, afterId: 'c' },
        ]);
    });

    it('puts entries before the first match at the start', () => {
        const result = compareReport(parseReport('1: Gone\n2: Kept'), [video('k', 'Kept')]);
        expect(result.missing).toEqual([{ number: 1, title: 'Gone', youtubeId: null, afterId: null }]);
    });

    it('matches each video once, so repeated titles need repeated videos', () => {
        const result = compareReport(parseReport('1: Same\n2: Same'), [video('s', 'Same')]);
        expect(result.missing.map((m) => [m.number, m.afterId])).toEqual([[2, 's']]);
    });

    it('matches link entries by YouTube ID and counts placeholders as present', () => {
        const entries = parseReport(
            '1: https://youtu.be/dQw4w9WgXcQ\n2: Restored earlier\n3: https://youtu.be/9bZkp7q19f0',
        );
        const result = compareReport(entries, [
            { id: 'r', youtubeId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up' },
            { id: 'p', youtubeId: '', title: 'Restored earlier' },
        ]);
        expect(result.missing).toEqual([
            { number: 3, title: 'https://youtu.be/9bZkp7q19f0', youtubeId: '9bZkp7q19f0', afterId: 'p' },
        ]);
    });
});

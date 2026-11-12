import { describe, it, expect } from 'vitest';
import {
    compareReport,
    FORMATS,
    parseReport,
    titleKey,
    type ComparedVideo,
    type ReportComparison,
} from './report-compare';
import { buildJsonReport, buildPlaylistReport, JSON_REPORT_FORMAT } from './report';

describe('parseReport', () => {
    it('reads a legacy report: numbered lines, skipping the total, blank lines and a BOM', () => {
        const text =
            '\uFEFFTotal videos: 3\r\n1: Anri - Windy Summer\r\n\r\n2:   4:00 A.M.  \r\n3: https://youtu.be/dQw4w9WgXcQ';
        expect(parseReport(text)).toEqual({
            format: 'legacy',
            entries: [
                {
                    number: 1,
                    title: 'Anri - Windy Summer',
                    artist: '',
                    youtubeId: null,
                },
                { number: 2, title: '4:00 A.M.', artist: '', youtubeId: null },
                {
                    number: 3,
                    title: 'https://youtu.be/dQw4w9WgXcQ',
                    artist: '',
                    youtubeId: 'dQw4w9WgXcQ',
                },
            ],
        });
    });

    it('keeps " | " as part of the title in a legacy report', () => {
        expect(parseReport('1: Anri | Windy Summer').entries[0]).toMatchObject({
            title: 'Anri | Windy Summer',
            artist: '',
        });
    });

    it('reads a report with artists, splitting each line on its last " | "', () => {
        const text = [
            'Total videos: 5',
            'Format: number: title | artist',
            '1: Windy Summer | Anri',
            '2: Meiko Nakahara - Peppermint no Asa (1983) | Meiko Nakahara',
            '3: Untitled live recording |',
            '4: Live | Studio | Ｔａｔｓｕｒｏ',
            '5: No separator here',
        ].join('\r\n');
        const { format, entries } = parseReport(text);
        expect(format).toBe('artists');
        expect(entries.map((e) => [e.title, e.artist])).toEqual([
            ['Windy Summer', 'Anri'],
            ['Meiko Nakahara - Peppermint no Asa (1983)', 'Meiko Nakahara'],
            ['Untitled live recording', ''],
            ['Live | Studio', 'Ｔａｔｓｕｒｏ'],
            ['No separator here', ''],
        ]);
    });

    it('reads what buildPlaylistReport writes', () => {
        const videos = [
            {
                youtubeId: 'dQw4w9WgXcQ',
                title: '竹内まりや - Plastic Love',
                artist: '竹内まりや',
            },
            { youtubeId: '9bZkp7q19f0', title: '' },
            { youtubeId: 'kJQP7kiw5Fk', title: 'A | B', artist: '' },
        ];
        const { format, entries } = parseReport(buildPlaylistReport(videos));
        expect(format).toBe('artists');
        expect(entries.map((e) => [e.youtubeId ?? e.title, e.artist])).toEqual([
            ['竹内まりや - Plastic Love', '竹内まりや'],
            ['9bZkp7q19f0', ''],
            ['A | B', ''],
        ]);
    });

    it('returns nothing for text without numbered lines', () => {
        expect(parseReport('just some notes\nTotal videos: 0').entries).toEqual([]);
    });
});

describe('titleKey', () => {
    it('ignores case, spacing, punctuation and full-width letters', () => {
        expect(titleKey('MAKOTO MATUSHITA　FIRST LIGHT')).toBe(titleKey('Makoto Matushita - First Light'));
        expect(titleKey('Ｄｏｗｎ Ｔｏｗｎ Ｇｉｒｌ / 彩恵津子')).toBe(titleKey('Down Town Girl 彩恵津子'));
        expect(titleKey('Anri - Windy Summer')).not.toBe(titleKey('Anri - Last Summer Whisper'));
    });
});

describe('compareReport', () => {
    const video = (id: string, title: string, artist = '', youtubeId = `${id}`.padEnd(11, 'x')) => ({
        id,
        title,
        artist,
        youtubeId,
    });
    const compare = (text: string, videos: ComparedVideo[]) => compareReport(parseReport(text), videos);

    it('finds missing entries and the video each one followed', () => {
        const result = compare('1: One\n2: Two\n3: Three\n4: Four\n5: Five', [
            video('a', 'one'),
            video('c', 'THREE'),
            video('e', 'Five'),
        ]);
        expect(result).toMatchObject({ format: 'legacy', total: 5, found: 3 });
        expect(result.missing).toEqual([
            {
                number: 2,
                title: 'Two',
                artist: '',
                youtubeId: null,
                afterId: 'a',
            },
            {
                number: 4,
                title: 'Four',
                artist: '',
                youtubeId: null,
                afterId: 'c',
            },
        ]);
    });

    it('puts entries before the first match at the start', () => {
        const result = compare('1: Gone\n2: Kept', [video('k', 'Kept')]);
        expect(result.missing).toEqual([
            {
                number: 1,
                title: 'Gone',
                artist: '',
                youtubeId: null,
                afterId: null,
            },
        ]);
    });

    it('matches each video once, so repeated titles need repeated videos', () => {
        const result = compare('1: Same\n2: Same', [video('s', 'Same')]);
        expect(result.missing.map((m) => [m.number, m.afterId])).toEqual([[2, 's']]);
    });

    it('matches link entries by YouTube ID and counts placeholders as present', () => {
        const result = compare(
            '1: https://youtu.be/dQw4w9WgXcQ\n2: Restored earlier\n3: https://youtu.be/9bZkp7q19f0',
            [
                {
                    id: 'r',
                    youtubeId: 'dQw4w9WgXcQ',
                    title: 'Never Gonna Give You Up',
                    artist: '',
                },
                {
                    id: 'p',
                    youtubeId: '',
                    title: 'Restored earlier',
                    artist: '',
                },
            ],
        );
        expect(result.missing).toEqual([
            {
                number: 3,
                title: 'https://youtu.be/9bZkp7q19f0',
                artist: '',
                youtubeId: '9bZkp7q19f0',
                afterId: 'p',
            },
        ]);
    });

    it('matches a legacy "artist - title" or "title - artist" to a video with a cleaned-up title', () => {
        const result = compare('1: Anri - Windy Summer\n2: Plastic Love / Mariya Takeuchi\n3: Anri - Gone', [
            video('w', 'Windy Summer', 'Anri'),
            video('p', 'Plastic Love', 'Mariya Takeuchi'),
        ]);
        expect(result.missing.map((m) => m.title)).toEqual(['Anri - Gone']);
    });

    it('uses the artist to tell apart videos with the same title', () => {
        const playlist = [video('a', 'Summer', 'Anri'), video('b', 'Summer', 'Tube')];
        const text = 'Format: number: title | artist\n1: Summer | Tube\n2: Summer | Someone Else';
        const result = compare(text, playlist);
        expect(result).toMatchObject({ format: 'artists', found: 2 });

        const onlyAnri = compare(text, [video('a', 'Summer', 'Anri')]);
        expect(onlyAnri.missing).toEqual([
            {
                number: 2,
                title: 'Summer',
                artist: 'Someone Else',
                youtubeId: null,
                afterId: 'a',
            },
        ]);
    });

    it('finds the same missing items in a legacy report and a report with artists', () => {
        const playlist = [
            video('a', 'Anri - Windy Summer', 'Anri'),
            video('c', 'Ｔｏｍｏｋｏ Ａｒａｎ - Midnight Pretenders', 'Tomoko Aran'),
        ];
        const legacy = [
            'Total videos: 4',
            '1: Anri - Windy Summer',
            '2: Miki Matsubara - Mayonaka no Door | Stay With Me',
            '3: Tomoko Aran - Midnight Pretenders',
            '4: https://youtu.be/9bZkp7q19f0',
        ].join('\r\n');
        const withArtists = [
            'Total videos: 4',
            'Format: number: title | artist',
            '1: Anri - Windy Summer | Anri',
            '2: Miki Matsubara - Mayonaka no Door | Stay With Me | Miki Matsubara',
            '3: Tomoko Aran - Midnight Pretenders | Tomoko Aran',
            '4: https://youtu.be/9bZkp7q19f0 |',
        ].join('\r\n');

        const strip = ({ missing }: ReportComparison) =>
            missing.map(({ number, title, youtubeId, afterId }) => ({
                number,
                title,
                youtubeId,
                afterId,
            }));
        expect(strip(compare(legacy, playlist))).toEqual(strip(compare(withArtists, playlist)));
        expect(strip(compare(legacy, playlist)).map((m) => m.number)).toEqual([2, 4]);
        expect(compare(withArtists, playlist).missing[0]!.artist).toBe('Miki Matsubara');
    });
});

describe('JSON reports', () => {
    const report = (videos: unknown[], extra = {}) =>
        JSON.stringify({ format: JSON_REPORT_FORMAT, version: 1, playlist: { name: 'House' }, videos, ...extra });
    const video = {
        youtubeId: 'aaaaaaaaaaa',
        title: 'Lady',
        artist: 'Modjo',
        author: 'ModjoOfficial',
        notes: 'Summer',
        unavailable: false,
    };

    it('reads what the app wrote, in order', () => {
        const written = buildJsonReport('House', [video, { ...video, youtubeId: '', title: 'Lost' }]);
        expect(parseReport(JSON.stringify(written))).toEqual({
            format: FORMATS.json,
            entries: [
                { ...video, number: 1 },
                { ...video, number: 2, youtubeId: null, title: 'Lost' },
            ],
        });
    });

    it('keeps each artist of a video with several, and ignores a list that is not one', () => {
        const artists = [
            { name: 'Simon & Garfunkel', role: 'main' as const },
            { name: 'Anri', role: 'featured' as const },
        ];
        const several = { ...video, artist: 'Simon & Garfunkel feat. Anri', artists };
        const written = buildJsonReport('House', [several, { ...video, artists: [{ name: 'Modjo', role: 'main' }] }]);
        expect(written.videos[1]).not.toHaveProperty('artists');
        expect(parseReport(JSON.stringify(written)).entries.map((e) => e.artists)).toEqual([artists, undefined]);
        expect(parseReport(report([{ ...video, artists: 'Modjo' }])).entries[0]).not.toHaveProperty('artists');
    });

    it('ignores the watched field of old reports', () => {
        const { entries } = parseReport(report([{ ...video, watched: true }]));
        expect(entries).toEqual([{ ...video, number: 1 }]);
    });

    it('matches by YouTube ID, even when the title changed', () => {
        const parsed = parseReport(report([video, { ...video, youtubeId: 'bbbbbbbbbbb', title: 'Gone' }]));
        const result = compareReport(parsed, [{ id: 'v1', youtubeId: 'aaaaaaaaaaa', title: 'Renamed' }]);
        expect(result).toMatchObject({ found: 1, missing: [{ youtubeId: 'bbbbbbbbbbb', afterId: 'v1' }] });
    });

    it.each([
        ['{ not json', "This file isn't valid JSON."],
        ['{"format":"other","version":1,"videos":[]}', "This JSON file isn't a report from this app."],
        [report([], { version: 2 }), 'This report is from a newer version of the app.'],
        [report([{ youtubeId: 'bad id' }]), "This report is damaged: a video in it can't be read."],
        [report([{ youtubeId: '' }]), "This report is damaged: a video in it can't be read."],
        [report([], { videos: 'none' }), "This report is damaged: a video in it can't be read."],
    ])('refuses %s', (source, error) => {
        expect(parseReport(source)).toEqual({ format: FORMATS.json, entries: [], error });
    });
});

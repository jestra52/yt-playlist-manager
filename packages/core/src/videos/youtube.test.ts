import { describe, it, expect } from 'vitest';
import {
    parseYouTubeId,
    parsePlaylistId,
    extractYouTubeIds,
    listKind,
    listProblem,
    parseYouTubeList,
    videoInPlaylist,
} from './youtube';

describe('parseYouTubeId', () => {
    it.each([
        ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123', 'dQw4w9WgXcQ'],
        ['youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
        ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://www.youtube.com/live/dQw4w9WgXcQ?feature=share', 'dQw4w9WgXcQ'],
        ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ])('%s', (input, id) => {
        expect(parseYouTubeId(input)).toBe(id);
    });

    it.each([
        '',
        'hello',
        'https://vimeo.com/123',
        'https://evil.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com/@channel',
    ])('rejects %s', (input) => {
        expect(parseYouTubeId(input)).toBeNull();
    });
});

describe('extractYouTubeIds', () => {
    it('handles many links, duplicates, junk and playlist links', () => {
        const text = `https://youtu.be/dQw4w9WgXcQ
      https://www.youtube.com/watch?v=9bZkp7q19f0, https://youtu.be/dQw4w9WgXcQ
      not-a-link https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf
      https://www.youtube.com/watch?v=kJQP7kiw5Fk&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf`;
        expect(extractYouTubeIds(text)).toEqual({
            ids: ['dQw4w9WgXcQ', '9bZkp7q19f0', 'kJQP7kiw5Fk'],
            playlistIds: ['PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'],
            invalid: ['not-a-link'],
            inPlaylist: 1,
        });
    });
});

describe('parsePlaylistId', () => {
    const id = 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf';
    it.each([
        [`https://www.youtube.com/playlist?list=${id}`, id],
        [`youtube.com/playlist?list=${id}&si=abc`, id],
        [`https://m.youtube.com/playlist?list=${id}`, id],
        [`https://music.youtube.com/playlist?list=${id}`, id],
        [`https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${id}&index=3`, id],
        [`https://youtu.be/dQw4w9WgXcQ?list=${id}`, id],
        [id, id],
        ['OLAK5uy_kzRUdbcOQn6Hm0rzEaYtTCoZLmNOjgkYU', 'OLAK5uy_kzRUdbcOQn6Hm0rzEaYtTCoZLmNOjgkYU'],
    ])('%s', (input, expected) => {
        expect(parsePlaylistId(input)).toBe(expected);
    });

    it.each([
        'Watch later',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        `https://evil.com/playlist?list=${id}`,
        'PLshort',
    ])('rejects %s', (input) => {
        expect(parsePlaylistId(input)).toBeNull();
    });
});

describe('listKind', () => {
    it.each([
        ['RDCMZRJb1jxzE', 'mix'],
        ['RDMM', 'mix'],
        ['RDAMVMdQw4w9WgXcQ', 'mix'],
        ['RDEMhe2mUnf9hDPhrWZ7Vp5XUA', 'mix'],
        ['RDGMEMQ1dJ7wXfLlqCjwV0xfSNbA', 'mix'],
        ['RDTMAK5uy_kset8DisdE7LSD4TNjEVvrKRTmG7a56sY', 'mix'],
        ['RDCLAK5uy_kmPRjHDECIcuVwnKsx2Ng7fyNgFKWNJFs', 'playlist'],
        ['PLsPETV9bmUbpSAj-kxXP4vzUvumC8TZUG', 'playlist'],
        ['OLAK5uy_kzRUdbcOQn6Hm0rzEaYtTCoZLmNOjgkYU', 'playlist'],
        ['UULFrAXtmErZgOeiKm4sgNOknG', 'playlist'],
        ['WL', 'private'],
        ['LL', 'private'],
        ['LM', 'private'],
    ])('%s is a %s', (id, kind) => {
        expect(listKind(id)).toBe(kind);
    });
});

describe('parseYouTubeList', () => {
    it('reads a Mix started from a video', () => {
        expect(
            parseYouTubeList('https://www.youtube.com/watch?v=CMZRJb1jxzE&list=RDCMZRJb1jxzE&start_radio=1'),
        ).toEqual({ id: 'RDCMZRJb1jxzE', kind: 'mix' });
    });

    it('reads a playlist a video is played from', () => {
        expect(parseYouTubeList('www.youtube.com/watch?v=QicgfPt_k6M&list=PLsPETV9bmUbpSAj-kxXP4vzUvumC8TZUG')).toEqual(
            {
                id: 'PLsPETV9bmUbpSAj-kxXP4vzUvumC8TZUG',
                kind: 'playlist',
            },
        );
    });

    it('treats any link with start_radio as a Mix', () => {
        expect(
            parseYouTubeList('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890&start_radio=1')?.kind,
        ).toBe('mix');
    });

    it('reads private lists', () => {
        expect(parseYouTubeList('https://www.youtube.com/playlist?list=WL')).toEqual({ id: 'WL', kind: 'private' });
    });

    it.each(['', 'Road trip', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://evil.com/playlist?list=RDMM'])(
        'finds no list in %s',
        (input) => {
            expect(parseYouTubeList(input)).toBeNull();
        },
    );
});

describe('Mixes and private lists', () => {
    const mix = 'https://www.youtube.com/watch?v=CMZRJb1jxzE&list=RDCMZRJb1jxzE&start_radio=1';

    it('are never read as a playlist to import', () => {
        expect(parsePlaylistId(mix)).toBeNull();
        expect(parsePlaylistId('https://www.youtube.com/playlist?list=WL')).toBeNull();
        expect(
            parsePlaylistId('https://music.youtube.com/playlist?list=RDCLAK5uy_kmPRjHDECIcuVwnKsx2Ng7fyNgFKWNJFs'),
        ).toBe('RDCLAK5uy_kmPRjHDECIcuVwnKsx2Ng7fyNgFKWNJFs');
    });

    it('say why they can’t be imported', () => {
        expect(listProblem(mix)).toMatch(/Mix/);
        expect(listProblem('https://www.youtube.com/playlist?list=LL')).toMatch(/private/);
        expect(listProblem('https://www.youtube.com/playlist?list=PLsPETV9bmUbpSAj-kxXP4vzUvumC8TZUG')).toBeNull();
        expect(listProblem('Road trip')).toBeNull();
    });

    it('add just the video when pasted as videos', () => {
        expect(
            extractYouTubeIds(
                `${mix} https://www.youtube.com/playlist?list=RDMM https://www.youtube.com/playlist?list=WL`,
            ),
        ).toEqual({
            ids: ['CMZRJb1jxzE'],
            playlistIds: [],
            invalid: ['https://www.youtube.com/playlist?list=RDMM', 'https://www.youtube.com/playlist?list=WL'],
            inPlaylist: 0,
        });
    });
});

describe('watch links played from a playlist', () => {
    const list = 'PLsPETV9bmUbpSAj-kxXP4vzUvumC8TZUG';
    const link = `www.youtube.com/watch?v=QicgfPt_k6M&list=${list}`;

    it('name both the video and the playlist', () => {
        expect(videoInPlaylist(link)).toEqual({
            id: 'QicgfPt_k6M',
            listId: list,
        });
        expect(videoInPlaylist(`https://www.youtube.com/playlist?list=${list}`)).toBeNull();
        expect(videoInPlaylist('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
        expect(videoInPlaylist('https://www.youtube.com/watch?v=CMZRJb1jxzE&list=RDCMZRJb1jxzE')).toBeNull();
    });

    it('add the video, or the whole playlist when asked', () => {
        expect(extractYouTubeIds(link)).toEqual({
            ids: ['QicgfPt_k6M'],
            playlistIds: [],
            invalid: [],
            inPlaylist: 1,
        });
        expect(
            extractYouTubeIds(`${link} https://youtu.be/dQw4w9WgXcQ`, {
                wholePlaylists: true,
            }),
        ).toEqual({
            ids: ['dQw4w9WgXcQ'],
            playlistIds: [list],
            invalid: [],
            inPlaylist: 1,
        });
    });
});

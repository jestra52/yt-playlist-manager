import { describe, expect, it } from 'vitest';
import {
    cleanCredits,
    creditsOf,
    creditsPatch,
    guessCredits,
    guessedArtistPatch,
    joinArtists,
    knownCreditNames,
    MAX_CREDITS,
    newVideoArtistPatch,
    parseCredits,
    splitArtists,
    type ArtistCredit,
} from './artist-credits';

const main = (name: string): ArtistCredit => ({ name, role: 'main' });
const featured = (name: string): ArtistCredit => ({ name, role: 'featured' });

describe('joinArtists', () => {
    it('joins main artists with & and adds featured ones after feat.', () => {
        expect(joinArtists([main('Anri')])).toBe('Anri');
        expect(joinArtists([main('Anri'), main('Tatsuro Yamashita')])).toBe('Anri & Tatsuro Yamashita');
        expect(joinArtists([main('Anri'), featured('Mariya Takeuchi'), featured('Junko Ohashi')])).toBe(
            'Anri feat. Mariya Takeuchi & Junko Ohashi',
        );
        expect(joinArtists([])).toBe('');
    });
});

describe('cleanCredits', () => {
    it('cleans names and drops empty and repeated artists', () => {
        expect(
            cleanCredits([main('  Anri '), main(''), main('ANRI'), featured('ａｎｒｉ'), featured('Taeko | Ohnuki')]),
        ).toEqual([main('Anri'), featured('Taeko / Ohnuki')]);
    });

    it('puts main artists before featured ones', () => {
        expect(cleanCredits([main('A'), featured('C'), main('B')])).toEqual([main('A'), main('B'), featured('C')]);
    });

    it('needs a main artist', () => {
        expect(cleanCredits([featured('C')])).toEqual([]);
    });

    it('keeps no more artists than fit in the display name', () => {
        const many = Array.from({ length: MAX_CREDITS + 5 }, (_, i) => main(`Artist ${i}`));
        expect(cleanCredits(many)).toHaveLength(MAX_CREDITS);
        const long = [main('a'.repeat(150)), main('b'.repeat(60)), featured('c')];
        expect(cleanCredits(long)).toEqual([main('a'.repeat(150))]);
    });
});

describe('parseCredits', () => {
    it('reads a stored list and ignores anything else', () => {
        expect(parseCredits('[{"name":"Anri","role":"main"},{"name":"x","role":"guest"},3]')).toEqual([main('Anri')]);
        expect(parseCredits('')).toEqual([]);
        expect(parseCredits('{"name":"Anri"}')).toEqual([]);
        expect(parseCredits('not json')).toEqual([]);
    });
});

describe('creditsOf', () => {
    it('uses the list while it matches the artist text', () => {
        const artists = [main('Anri'), featured('Mariya Takeuchi')];
        expect(creditsOf({ artist: 'Anri feat. Mariya Takeuchi', artists })).toEqual(artists);
    });

    it('makes the text one main artist when an older app changed it', () => {
        expect(creditsOf({ artist: 'Tomoko Aran', artists: [main('Anri'), main('Tatsuro Yamashita')] })).toEqual([
            main('Tomoko Aran'),
        ]);
    });

    it('keeps a name with & in it as one artist', () => {
        expect(creditsOf({ artist: 'Simon & Garfunkel', artists: [] })).toEqual([main('Simon & Garfunkel')]);
    });

    it('is empty without an artist', () => {
        expect(creditsOf({ artist: '', artists: [main('Anri')] })).toEqual([]);
    });
});

describe('creditsPatch', () => {
    it('stores the list only when there is more than one artist', () => {
        expect(creditsPatch([main(' Anri ')])).toEqual({ artist: 'Anri', artists: [] });
        expect(creditsPatch([featured('C'), main('A')])).toEqual({
            artist: 'A feat. C',
            artists: [main('A'), featured('C')],
        });
        expect(creditsPatch([])).toEqual({ artist: '', artists: [] });
    });
});

describe('knownCreditNames', () => {
    it('counts each artist on their own, featured ones too', () => {
        const videos = [
            { artist: 'Anri & Tatsuro Yamashita', artists: [main('Anri'), main('Tatsuro Yamashita')] },
            { artist: 'Mariya Takeuchi feat. Anri', artists: [main('Mariya Takeuchi'), featured('Anri')] },
            { artist: 'Tatsuro Yamashita' },
        ];
        expect(knownCreditNames(videos)).toEqual(['Anri', 'Tatsuro Yamashita', 'Mariya Takeuchi']);
    });
});

describe('splitArtists', () => {
    it.each([
        ['Anri & Tatsuro Yamashita', ['Anri', 'Tatsuro Yamashita'], []],
        ['Anri × Tatsuro Yamashita', ['Anri', 'Tatsuro Yamashita'], []],
        ['Anri x Tatsuro Yamashita', ['Anri', 'Tatsuro Yamashita'], []],
        ['Anri, Junko Ohashi and Tatsuro Yamashita', ['Anri', 'Junko Ohashi', 'Tatsuro Yamashita'], []],
        ['杏里、山下達郎', ['杏里', '山下達郎'], []],
        ['Anri with Tatsuro Yamashita', ['Anri', 'Tatsuro Yamashita'], []],
        ['Anri vs. Tatsuro Yamashita', ['Anri', 'Tatsuro Yamashita'], []],
        ['Anri feat. Mariya Takeuchi', ['Anri'], ['Mariya Takeuchi']],
        ['Anri ft. Mariya Takeuchi & Junko Ohashi', ['Anri'], ['Mariya Takeuchi', 'Junko Ohashi']],
        ['Anri featuring Mariya Takeuchi', ['Anri'], ['Mariya Takeuchi']],
        ['Anri (feat. Mariya Takeuchi)', ['Anri'], ['Mariya Takeuchi']],
        ['Jay-Z', ['Jay-Z'], []],
        ['Malcolm X', ['Malcolm X'], []],
        ['Alexander', ['Alexander'], []],
        ['Lefty', ['Lefty'], []],
    ])('reads "%s"', (text, mains, featureds) => {
        expect(splitArtists(text)).toEqual([...mains.map(main), ...featureds.map(featured)]);
    });
});

describe('guessCredits', () => {
    it('splits the guessed artist and adds who the title features', () => {
        expect(guessCredits({ title: 'Anri & Tatsuro Yamashita - Windy Summer' })).toEqual([
            main('Anri'),
            main('Tatsuro Yamashita'),
        ]);
        expect(guessCredits({ title: 'Anri - Windy Summer (feat. Mariya Takeuchi) [Official Video]' })).toEqual([
            main('Anri'),
            featured('Mariya Takeuchi'),
        ]);
        expect(guessCredits({ title: 'Anri feat. Mariya Takeuchi - Windy Summer' })).toEqual([
            main('Anri'),
            featured('Mariya Takeuchi'),
        ]);
        expect(guessCredits({ title: 'Anri - Windy Summer ft. Junko Ohashi' })).toEqual([
            main('Anri'),
            featured('Junko Ohashi'),
        ]);
    });

    it('keeps a Topic channel as one artist', () => {
        expect(guessCredits({ title: 'Windy Summer (feat. C)', author: 'Earth, Wind & Fire - Topic' })).toEqual([
            main('Earth, Wind & Fire'),
            featured('C'),
        ]);
    });

    it('guesses nothing without an artist', () => {
        expect(guessCredits({ title: 'Windy Summer (feat. Mariya Takeuchi)' })).toEqual([]);
    });
});

describe('newVideoArtistPatch', () => {
    it('replaces or clears a guess, and keeps an artist set by hand', () => {
        const guessed = { title: 'Old', author: '', artist: 'Old Artist', artistSource: 'guess' as const };
        expect(newVideoArtistPatch(guessed, { title: 'Anri & Junko Ohashi - Windy Summer' })).toEqual({
            artist: 'Anri & Junko Ohashi',
            artists: [main('Anri'), main('Junko Ohashi')],
            artistSource: 'guess',
        });
        expect(newVideoArtistPatch(guessed, { title: 'Windy Summer' })).toEqual({
            artist: '',
            artists: [],
            artistSource: '',
        });
        expect(newVideoArtistPatch({ ...guessed, artistSource: 'user' }, { title: 'Anri - Windy Summer' })).toEqual({});
    });
});

describe('guessedArtistPatch', () => {
    it('returns the guess with its source', () => {
        expect(guessedArtistPatch({ title: 'Anri - Windy Summer', author: '', artist: '', artistSource: '' })).toEqual({
            artist: 'Anri',
            artists: [],
            artistSource: 'guess',
        });
    });

    it('guesses from new metadata when given', () => {
        const video = { title: '', author: '', artist: '', artistSource: '' };
        expect(guessedArtistPatch(video, { title: 'Song', author: 'Anri - Topic' })).toEqual({
            artist: 'Anri',
            artists: [],
            artistSource: 'guess',
        });
    });

    it('keeps a hand edit, even an empty one, and an unchanged guess', () => {
        expect(
            guessedArtistPatch({ title: 'Anri - Windy Summer', author: '', artist: '', artistSource: 'user' }),
        ).toEqual({});
        expect(
            guessedArtistPatch({ title: 'Anri - Windy Summer', author: '', artist: 'Anri', artistSource: 'guess' }),
        ).toEqual({});
    });
});

describe('splitting with the names the library knows', () => {
    const known = ['Earth, Wind & Fire', 'Simon & Garfunkel', 'Anri'];

    it('keeps a known name whole, in its spelling', () => {
        expect(splitArtists('earth, wind & fire', known)).toEqual([main('Earth, Wind & Fire')]);
        expect(splitArtists('Simon & Garfunkel', known)).toEqual([main('Simon & Garfunkel')]);
    });

    it('still splits the names around it', () => {
        expect(splitArtists('Anri & Earth, Wind & Fire feat. Simon & Garfunkel, Junko Ohashi', known)).toEqual([
            main('Anri'),
            main('Earth, Wind & Fire'),
            featured('Simon & Garfunkel'),
            featured('Junko Ohashi'),
        ]);
    });

    it('splits an unknown name as before', () => {
        expect(splitArtists('Earth, Wind & Fire')).toEqual([main('Earth'), main('Wind'), main('Fire')]);
    });

    it('guesses with them too', () => {
        expect(guessCredits({ title: 'Earth, Wind & Fire - September' }, known)).toEqual([main('Earth, Wind & Fire')]);
        expect(
            guessedArtistPatch(
                { title: 'Earth, Wind & Fire - September', author: '', artist: '', artistSource: '' },
                {},
                known,
            ),
        ).toEqual({ artist: 'Earth, Wind & Fire', artists: [], artistSource: 'guess' });
    });
});

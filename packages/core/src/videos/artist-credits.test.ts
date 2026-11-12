import { describe, expect, it } from 'vitest';
import {
    cleanCredits,
    creditsOf,
    creditsPatch,
    joinArtists,
    knownCreditNames,
    MAX_CREDITS,
    parseCredits,
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

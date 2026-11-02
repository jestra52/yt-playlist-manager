import { describe, it, expect } from 'vitest';
import {
    canReplaceArtist,
    cleanArtist,
    guessArtist,
    guessedArtistPatch,
    knownArtists,
    matchKnownArtist,
} from './artist.js';

describe('guessArtist', () => {
    it('takes the artist from an auto-generated "Artist - Topic" channel first', () => {
        expect(guessArtist({ title: 'Windy Summer', author: 'Anri - Topic' })).toBe('Anri');
        expect(guessArtist({ title: 'Someone Else - Song', author: '杏里 - Topic' })).toBe('杏里');
    });

    it.each([
        ['Meiko Nakahara - Dance in the memories', 'Meiko Nakahara'],
        ['杏里 Anri - Lady Sunshine', '杏里 Anri'],
        ['Anri – Windy Summer', 'Anri'],
        ['Anri — Windy Summer', 'Anri'],
        ['Tatsuro Yamashita / Ride on Time', 'Tatsuro Yamashita'],
        ['竹内まりや「プラスティック・ラブ」', '竹内まりや'],
        ['Miki Matsubara『真夜中のドア』', 'Miki Matsubara'],
        ['Mariya Takeuchi - Plastic Love (Official Music Video)', 'Mariya Takeuchi'],
        ['[MV] Meiko Nakahara - Peppermint no Asa (1983)', 'Meiko Nakahara'],
        ['【Official Audio】Junko Yagami - Bay City', 'Junko Yagami'],
        ['Bay City (Live at Budokan)', ''],
        ['Jay-Z - Empire State of Mind', 'Jay-Z'],
    ])('%s → %s', (title, artist) => {
        expect(guessArtist({ title, author: 'Raven Almazan' })).toBe(artist);
    });

    it('leaves it empty rather than guess', () => {
        expect(guessArtist({ title: 'Untitled live recording', author: 'Jim Gutierrez' })).toBe('');
        expect(guessArtist({ title: 'AC/DC Back in Black', author: '' })).toBe('');
        expect(guessArtist({ title: 'Song - ', author: '' })).toBe('');
        expect(guessArtist({ title: '- Song', author: '' })).toBe('');
        expect(guessArtist({ title: `${'a'.repeat(90)} - Song`, author: '' })).toBe('');
        expect(guessArtist({})).toBe('');
    });
});

describe('canReplaceArtist', () => {
    it('lets a guess replace nothing or another guess, but never a hand edit', () => {
        expect(canReplaceArtist({ artistSource: '' }, 'guess')).toBe(true);
        expect(canReplaceArtist({ artistSource: 'guess' }, 'guess')).toBe(true);
        expect(canReplaceArtist({ artistSource: 'user' }, 'guess')).toBe(false);
        expect(canReplaceArtist({ artistSource: 'guess' }, 'user')).toBe(true);
    });

    it('treats a source this version doesn’t know as no source', () => {
        expect(canReplaceArtist({ artistSource: 'from-the-future' }, 'guess')).toBe(true);
    });
});

describe('guessedArtistPatch', () => {
    it('returns the guess with its source', () => {
        expect(guessedArtistPatch({ title: 'Anri - Windy Summer', author: '', artist: '', artistSource: '' })).toEqual({
            artist: 'Anri',
            artistSource: 'guess',
        });
    });

    it('guesses from new metadata when given', () => {
        const video = { title: '', author: '', artist: '', artistSource: '' };
        expect(guessedArtistPatch(video, { title: 'Song', author: 'Anri - Topic' })).toEqual({
            artist: 'Anri',
            artistSource: 'guess',
        });
    });

    it('keeps a hand edit, even an empty one', () => {
        const video = { title: 'Anri - Windy Summer', author: '', artist: '', artistSource: 'user' };
        expect(guessedArtistPatch(video)).toEqual({});
    });
});

describe('knownArtists and matchKnownArtist', () => {
    const library = [
        { artist: 'Tomoko Aran' },
        { artist: 'Anri' },
        { artist: 'Tomoko Aran' },
        { artist: 'tomoko  aran' },
        { artist: '' },
    ];

    it('lists each artist once, in its most used spelling, most used first', () => {
        expect(knownArtists(library)).toEqual(['Tomoko Aran', 'Anri']);
    });

    it('snaps an edit to the spelling the library already uses', () => {
        const known = knownArtists(library);
        expect(matchKnownArtist(' TOMOKO   aran ', known)).toBe('Tomoko Aran');
        expect(matchKnownArtist('Ａｎｒｉ', known)).toBe('Anri');
        expect(matchKnownArtist('Miki Matsubara', known)).toBe('Miki Matsubara');
        expect(matchKnownArtist('  ', known)).toBe('');
    });
});

describe('cleanArtist', () => {
    it('keeps the artist on one line without the report separator', () => {
        expect(cleanArtist('  Anri |\nTatsuro  ')).toBe('Anri / Tatsuro');
    });
});

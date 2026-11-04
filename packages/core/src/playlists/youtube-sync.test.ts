import { describe, it, expect } from 'vitest';
import { diffWithYouTube, hasChanges, type SourceVideo, type YouTubeDiff } from './youtube-sync';

const video = (id: string, youtubeId: string, extra = {}) => ({
    id,
    youtubeId,
    title: id,
    unavailable: false,
    ...extra,
});
const item = (youtubeId: string, extra = {}) => ({
    youtubeId,
    title: `Title ${youtubeId}`,
    author: 'A',
    thumbnailUrl: '',
    ...extra,
});
const fromApi = (videos: SourceVideo[], extra = {}) => ({
    source: 'api',
    partial: false,
    videos,
    ...extra,
});

describe('diffWithYouTube', () => {
    it('adds new videos in YouTube’s order, after the video that precedes them there', () => {
        const playlist = [video('a', 'aaaaaaaaaaa'), video('c', 'ccccccccccc')];
        const diff = diffWithYouTube(
            playlist,
            fromApi([
                item('nnnnnnnnnn1'),
                item('aaaaaaaaaaa'),
                item('bbbbbbbbbbb'),
                item('bbbbbbbbbb2'),
                item('ccccccccccc'),
            ]),
        );
        expect(diff.added.map((a) => [a.youtubeId, a.afterId])).toEqual([
            ['nnnnnnnnnn1', null],
            ['bbbbbbbbbbb', 'a'],
            ['bbbbbbbbbb2', 'a'],
        ]);
        expect(diff).toMatchObject({
            complete: true,
            nowUnavailable: [],
            availableAgain: [],
            removed: [],
        });
    });

    it('marks videos deleted on YouTube, and clears the mark when they come back', () => {
        const playlist = [video('a', 'aaaaaaaaaaa'), video('b', 'bbbbbbbbbbb', { unavailable: true })];
        const diff = diffWithYouTube(
            playlist,
            fromApi([
                item('aaaaaaaaaaa', {
                    title: 'Deleted video',
                    unavailable: true,
                }),
                item('bbbbbbbbbbb'),
            ]),
        );
        expect(diff.nowUnavailable.map((v) => v.id)).toEqual(['a']);
        expect(diff.availableAgain.map((v) => v.id)).toEqual(['b']);
        expect(diff.added).toEqual([]);
        expect(diff.removed).toEqual([]);
    });

    it('adds deleted videos the playlist doesn’t have only when asked', () => {
        const source = fromApi([
            item('aaaaaaaaaaa'),
            item('ddddddddddd', { title: 'Deleted video', unavailable: true }),
        ]);
        expect(diffWithYouTube([], source).added.map((a) => a.youtubeId)).toEqual(['aaaaaaaaaaa']);
        expect(
            diffWithYouTube([], source, { includeUnavailable: true }).added.map((a) => [a.youtubeId, a.unavailable]),
        ).toEqual([
            ['aaaaaaaaaaa', false],
            ['ddddddddddd', true],
        ]);
    });

    it('lists videos removed from the YouTube playlist, leaving placeholders alone', () => {
        const playlist = [
            video('a', 'aaaaaaaaaaa'),
            video('r', 'rrrrrrrrrrr'),
            video('p', '', { title: 'From a report' }),
        ];
        const diff = diffWithYouTube(playlist, fromApi([item('aaaaaaaaaaa')]));
        expect(diff.removed.map((v) => v.id)).toEqual(['r']);
    });

    it('doesn’t trust removals when YouTube only returned part of the playlist', () => {
        const playlist = [video('a', 'aaaaaaaaaaa'), video('o', 'ooooooooooo')];
        const partial = diffWithYouTube(
            playlist,
            fromApi([item('aaaaaaaaaaa'), item('nnnnnnnnnnn')], {
                partial: true,
            }),
        );
        expect(partial).toMatchObject({ complete: false, removed: [] });
        expect(partial.added.map((a) => a.youtubeId)).toEqual(['nnnnnnnnnnn']);

        const feed = diffWithYouTube(playlist, {
            source: 'feed',
            partial: false,
            videos: [item('aaaaaaaaaaa')],
        });
        expect(feed).toMatchObject({ complete: false, removed: [] });
    });

    it('adds a video listed twice on YouTube only once', () => {
        const diff = diffWithYouTube([], fromApi([item('aaaaaaaaaaa'), item('aaaaaaaaaaa')]));
        expect(diff.added).toHaveLength(1);
    });
});

describe('hasChanges', () => {
    const empty: YouTubeDiff = {
        complete: false,
        added: [],
        nowUnavailable: [],
        availableAgain: [],
        removed: [],
    };

    it('counts removals only when they will be applied', () => {
        expect(hasChanges(empty)).toBe(false);
        expect(hasChanges({ ...empty, removed: [video('r', 'rrrrrrrrrrr')] })).toBe(false);
        expect(hasChanges({ ...empty, removed: [video('r', 'rrrrrrrrrrr')] }, { removeMissing: true })).toBe(true);
        expect(
            hasChanges({
                ...empty,
                nowUnavailable: [video('a', 'aaaaaaaaaaa')],
            }),
        ).toBe(true);
    });
});

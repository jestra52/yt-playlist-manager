import { describe, it, expect } from 'vitest';
import { parseYouTubeId, extractYouTubeIds } from './youtube.js';

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
      not-a-link https://www.youtube.com/playlist?list=PLabc`;
        expect(extractYouTubeIds(text)).toEqual({
            ids: ['dQw4w9WgXcQ', '9bZkp7q19f0'],
            invalid: ['not-a-link'],
            playlistLinks: 1,
        });
    });
});

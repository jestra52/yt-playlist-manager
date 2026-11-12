import {
    artistKey,
    canReplaceArtist,
    cleanArtist,
    guessArtist,
    knownArtists,
    topicArtist,
    type ArtistFields,
    type ArtistSource,
} from './artist';

/**
 * A video's artists, in order: one or more main artists, then any featured ones.
 * The video's `artist` text stays the joined display name ("A & B feat. C"), so
 * older apps, reports and search keep working with it.
 */
export type ArtistRole = 'main' | 'featured';

export interface ArtistCredit {
    name: string;
    role: ArtistRole;
}

export const MAX_CREDITS = 10;
const MAX_DISPLAY = 200;

/** "A & B feat. C". */
export const joinArtists = (credits: readonly ArtistCredit[]): string => {
    const names = (role: ArtistRole) =>
        credits
            .filter((c) => c.role === role)
            .map((c) => c.name)
            .join(' & ');
    const main = names('main');
    const featured = names('featured');
    return featured ? `${main} feat. ${featured}` : main;
};

/**
 * Clean names, no empty or repeated artists, main artists before featured ones,
 * and no more than fit in the display name. Featured artists need a main one.
 */
export const cleanCredits = (credits: readonly ArtistCredit[]): ArtistCredit[] => {
    const seen = new Set<string>();
    const unique: ArtistCredit[] = [];
    for (const credit of credits) {
        const name = cleanArtist(credit.name);
        const key = artistKey(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push({ name, role: credit.role === 'featured' ? 'featured' : 'main' });
    }
    const ordered = [...unique.filter((c) => c.role === 'main'), ...unique.filter((c) => c.role === 'featured')];
    if (ordered[0]?.role !== 'main') return [];
    const kept: ArtistCredit[] = [];
    for (const credit of ordered.slice(0, MAX_CREDITS)) {
        if (joinArtists([...kept, credit]).length > MAX_DISPLAY) break;
        kept.push(credit);
    }
    return kept;
};

/** The stored JSON list, or an empty one when it isn't a list of credits. */
export const parseCredits = (json: string | null | undefined): ArtistCredit[] => {
    try {
        const value: unknown = JSON.parse(json || '[]');
        if (!Array.isArray(value)) return [];
        return value.filter(
            (c): c is ArtistCredit =>
                typeof c === 'object' &&
                c !== null &&
                typeof (c as ArtistCredit).name === 'string' &&
                ((c as ArtistCredit).role === 'main' || (c as ArtistCredit).role === 'featured'),
        );
    } catch {
        return [];
    }
};

/**
 * A video's artists. The list counts only while it still matches the `artist`
 * text: an older app that edits the text alone makes it one main artist again.
 */
export const creditsOf = (video: { artist?: string; artists?: readonly ArtistCredit[] }): ArtistCredit[] => {
    const artist = cleanArtist(video.artist);
    if (!artist) return [];
    const credits = cleanCredits(video.artists ?? []);
    if (credits.length && joinArtists(credits) === artist) return credits;
    return [{ name: artist, role: 'main' }];
};

/** The `{ artist, artists }` patch that gives a video these artists. */
export const creditsPatch = (credits: readonly ArtistCredit[]): { artist: string; artists: ArtistCredit[] } => {
    const clean = cleanCredits(credits);
    return { artist: joinArtists(clean), artists: clean.length > 1 ? clean : [] };
};

/** Every artist of these videos on their own, most used first (see `knownArtists`). */
export const knownCreditNames = (
    videos: readonly { artist?: string; artists?: readonly ArtistCredit[] }[],
): string[] => {
    return knownArtists(videos.flatMap((video) => creditsOf(video).map(({ name }) => ({ artist: name }))));
};

// "A (feat. C)" or "A [ft. C]": the brackets go, the credit stays.
const BRACKETED_FEAT = /\s*[([【]\s*((?:feat\.?|ft\.?|featuring)\s+[^()[\]【】]+)[)\]】]/giu;
const FEAT_SPLIT = /\s+(?:feat\.?|ft\.?|featuring)\s+/iu;
// "A & B", "A × B", "A x B", "A, B", "A、B", "A and B", "A with B", "A vs. B".
const SEPARATORS = /\s*[&＆×,、]\s*|\s+(?:x|and|with|vs\.?)\s+/iu;

const names = (part: string) => part.split(SEPARATORS).map((name) => name.trim());

/** Reads "A & B feat. C" (and the other ways titles write it) as separate artists. */
export const splitArtists = (text: string | null | undefined): ArtistCredit[] => {
    const clean = cleanArtist(text).replace(BRACKETED_FEAT, ' $1');
    const [main = '', ...featured] = clean.split(FEAT_SPLIT);
    return cleanCredits([
        ...names(main).map((name) => ({ name, role: 'main' as const })),
        ...featured.flatMap(names).map((name) => ({ name, role: 'featured' as const })),
    ]);
};

// The featured artists a title names after the song: "Song (feat. C)" or "Song ft. C".
const FEATURED_IN_TITLE = /(?:^|[\s([【])(?:feat\.?|ft\.?|featuring)\s+([^()[\]【】]+)/iu;
const SONG_SEPARATOR = /\s+[-–—/／|]\s+/u;

/**
 * Best guess at a video's artists (see `guessArtist`): the artist part split
 * into main and featured artists, plus anyone the title credits with "feat.".
 * A "Artist - Topic" channel is one artist.
 */
export const guessCredits = ({ title = '', author = '' }: { title?: string; author?: string } = {}): ArtistCredit[] => {
    const guess = guessArtist({ title, author });
    if (!guess) return [];
    const topic = topicArtist(author);
    const credits = topic ? [{ name: topic, role: 'main' as const }] : splitArtists(guess);
    const featured = (title.match(FEATURED_IN_TITLE)?.[1] ?? '').split(SONG_SEPARATOR)[0]!;
    return cleanCredits([...credits, ...names(featured).map((name) => ({ name, role: 'featured' as const }))]);
};

type GuessPatch = { artist?: string; artists?: ArtistCredit[]; artistSource?: ArtistSource };

/**
 * The patch that applies a guess to a video, or an empty patch when there is
 * nothing to guess or the video's artist came from a stronger source.
 */
export const guessedArtistPatch = (
    video: ArtistFields | null | undefined,
    { title = video?.title, author = video?.author }: { title?: string; author?: string } = {},
): GuessPatch => {
    if (!canReplaceArtist(video, 'guess')) return {};
    const credits = guessCredits({ title, author });
    if (!credits.length || joinArtists(credits) === video?.artist) return {};
    return { ...creditsPatch(credits), artistSource: 'guess' };
};

/** Like `guessedArtistPatch`, for a row that now holds another video: an old guess doesn't carry over. */
export const newVideoArtistPatch = (
    video: ArtistFields | null | undefined,
    { title, author }: { title?: string; author?: string },
): GuessPatch => {
    if (!canReplaceArtist(video, 'guess')) return {};
    const patch = creditsPatch(guessCredits({ title, author }));
    return { ...patch, artistSource: patch.artist ? 'guess' : '' };
};

import { artistKey, cleanArtist } from './artist';

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

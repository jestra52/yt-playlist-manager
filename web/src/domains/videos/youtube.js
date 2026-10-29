const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const PATH_PREFIXES = ['embed', 'shorts', 'live', 'v', 'e'];

export function isYouTubeId(value) {
  return ID.test(value);
}

/**
 * Extracts the video ID from a YouTube link (watch, youtu.be, shorts, embed,
 * live, music) or a bare 11-character ID. Returns null when there is none.
 */
export function parseYouTubeId(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  if (isYouTubeId(raw)) return raw;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    return isYouTubeId(parts[0] ?? '') ? parts[0] : null;
  }
  if (!HOSTS.has(host)) return null;

  const v = url.searchParams.get('v');
  if (v && isYouTubeId(v)) return v;
  if (parts.length >= 2 && PATH_PREFIXES.includes(parts[0]) && isYouTubeId(parts[1])) return parts[1];
  return null;
}

/** True for playlist links without a specific video. */
function isPlaylistOnly(token) {
  return /[?&]list=/.test(token) && !parseYouTubeId(token);
}

/**
 * Splits pasted text (one or many links, separated by spaces, commas or new
 * lines) into unique video IDs, and reports what couldn't be read.
 */
export function extractYouTubeIds(text) {
  const tokens = String(text ?? '')
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const ids = [];
  const invalid = [];
  let playlistLinks = 0;
  for (const token of tokens) {
    const id = parseYouTubeId(token);
    if (id) {
      if (!ids.includes(id)) ids.push(id);
    } else if (isPlaylistOnly(token)) {
      playlistLinks++;
    } else {
      invalid.push(token);
    }
  }
  return { ids, invalid, playlistLinks };
}

export function thumbnailFor(youtubeId) {
  return `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;
}

export function watchUrl(youtubeId) {
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}

export function embedUrl(youtubeId) {
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`;
}

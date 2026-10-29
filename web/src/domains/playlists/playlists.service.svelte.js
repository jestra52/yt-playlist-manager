import { getDatabase } from '../../core/db/index.js';
import { dataChanged } from '../../core/events.js';
import { notify } from '../ui/ui.service.svelte.js';
import { videos } from '../videos/videos.service.svelte.js';
import * as repo from './playlists.repository.js';

const LAST_SELECTED_KEY = 'ytpm:selectedPlaylist';

function remember(id) {
  try {
    if (id) localStorage.setItem(LAST_SELECTED_KEY, id);
  } catch {
    /* storage unavailable: the selection just isn't remembered */
  }
}

function recall() {
  try {
    return localStorage.getItem(LAST_SELECTED_KEY);
  } catch {
    return null;
  }
}

/** Application layer for playlists: reactive list + selection + use cases. */
class PlaylistsService {
  items = $state([]);
  selectedId = $state(null);

  selected = $derived(this.items.find((p) => p.id === this.selectedId) ?? null);

  load() {
    this.items = repo.listPlaylists(getDatabase());
    const preferred = this.selectedId ?? recall();
    this.selectedId = this.items.some((p) => p.id === preferred) ? preferred : (this.items[0]?.id ?? null);
  }

  select(id) {
    this.selectedId = id;
    remember(id);
  }

  create(name, description = '') {
    try {
      const playlist = repo.createPlaylist(getDatabase(), { name, description });
      this.items = [...this.items, playlist];
      this.select(playlist.id);
      dataChanged();
      return playlist;
    } catch (err) {
      notify(err.message, { tone: 'error' });
      return null;
    }
  }

  rename(id, name) {
    this.#update(id, { name });
  }

  describe(id, description) {
    this.#update(id, { description });
  }

  /** Deletes the playlist and its videos (as tombstones, so it syncs). */
  remove(id) {
    const index = this.items.findIndex((p) => p.id === id);
    if (index === -1) return;
    const { name } = this.items[index];
    repo.deletePlaylist(getDatabase(), id);
    this.items = this.items.filter((p) => p.id !== id);
    videos.dropPlaylist(id);
    if (this.selectedId === id) this.select(this.items[Math.min(index, this.items.length - 1)]?.id ?? null);
    dataChanged();
    notify(`Deleted “${name}”`);
  }

  #update(id, patch) {
    try {
      const playlist = repo.updatePlaylist(getDatabase(), id, patch);
      this.items = this.items.map((p) => (p.id === id ? playlist : p));
      dataChanged();
    } catch (err) {
      notify(err.message, { tone: 'error' });
    }
  }
}

export const playlists = new PlaylistsService();

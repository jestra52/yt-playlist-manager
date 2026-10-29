import { applyTheme, savedTheme } from './theme.js';

/**
 * App-shell state: the mobile playlist drawer, the sync dialog, the
 * appearance setting and short notices at the bottom of the screen.
 */
class UiService {
  sidebarOpen = $state(false);
  settingsOpen = $state(false);
  theme = $state(typeof localStorage === 'undefined' ? 'system' : savedTheme());
  notices = $state([]);

  #nextNoticeId = 1;

  toggleSidebar(open = !this.sidebarOpen) {
    this.sidebarOpen = open;
  }

  openSettings() {
    this.sidebarOpen = false;
    this.settingsOpen = true;
  }

  closeSettings() {
    this.settingsOpen = false;
  }

  setTheme(theme) {
    this.theme = theme;
    applyTheme(theme);
  }

  /** Shows a short message; `undo` adds an Undo button. */
  notify(message, { tone = 'info', timeout = 4000, undo = null } = {}) {
    const id = this.#nextNoticeId++;
    this.notices = [...this.notices.slice(-2), { id, message, tone, undo }];
    if (timeout) setTimeout(() => this.dismiss(id), timeout);
    return id;
  }

  dismiss(id) {
    this.notices = this.notices.filter((n) => n.id !== id);
  }
}

export const ui = new UiService();

/** Shorthand used by the other services. */
export const notify = (message, options) => ui.notify(message, options);

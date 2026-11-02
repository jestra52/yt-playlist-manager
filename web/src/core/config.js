/**
 * Runtime configuration shared across domains. The sync service keeps the
 * API address up to date when its settings load or change.
 */
let apiBase = '/api';

/**
 * Where the app's source code is published, linked from the sidebar. The AGPL
 * (see LICENSE) asks anyone running a modified version for others to offer them
 * its source, so a modified version should point this at its own code.
 */
export const SOURCE_URL = 'https://github.com/jestra52/yt-playlist-manager';

export const getApiBase = () => {
    return apiBase;
};

export const setApiBase = (value) => {
    apiBase = (value || '/api').replace(/\/+$/, '');
};

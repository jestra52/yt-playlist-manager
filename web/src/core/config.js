/**
 * Runtime configuration shared across domains. The sync service keeps the
 * API address up to date when its settings load or change.
 */
let apiBase = '/api';

export const getApiBase = () => {
    return apiBase;
};

export const setApiBase = (value) => {
    apiBase = (value || '/api').replace(/\/+$/, '');
};

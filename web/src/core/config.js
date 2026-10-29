/**
 * Runtime configuration shared across domains. The sync service keeps the
 * API address up to date when its settings load or change.
 */
let apiBase = '/api';

export function getApiBase() {
  return apiBase;
}

export function setApiBase(value) {
  apiBase = (value || '/api').replace(/\/+$/, '');
}

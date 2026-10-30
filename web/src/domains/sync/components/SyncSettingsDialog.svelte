<script>
    import { untrack } from 'svelte';
    import Dialog from '../../../shared/components/Dialog.svelte';
    import Icon from '../../../shared/components/Icon.svelte';
    import { getDatabase } from '../../../core/db/index.js';
    import { sync } from '../sync.service.svelte.js';
    import { ui, notify } from '../../ui/ui.service.svelte.js';

    let apiUrl = $state('/api');
    let token = $state('');
    let autoSync = $state(true);
    let showToken = $state(false);
    let testing = $state(false);
    let result = $state(null);

    // Load the saved values each time the dialog opens.
    $effect(() => {
        if (!ui.settingsOpen) return;
        const s = $state.snapshot(untrack(() => sync.settings));
        apiUrl = s.apiUrl;
        token = s.token;
        autoSync = s.autoSync;
        result = null;
    });

    const test = async () => {
        testing = true;
        result = await sync.testConnection({ apiUrl });
        testing = false;
    };

    const save = async (event) => {
        event.preventDefault();
        sync.saveSettings({ apiUrl, token, autoSync });
        ui.closeSettings();
        if (token.trim()) sync.syncNow();
        else notify('Sync is off. Your playlists stay on this device.');
    };

    const exportDatabase = () => {
        const bytes = getDatabase().export();
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.sqlite3' }));
        const a = Object.assign(document.createElement('a'), {
            href: url,
            download: `queue-${new Date().toISOString().slice(0, 10)}.sqlite`,
        });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
</script>

<Dialog open={ui.settingsOpen} title="Sync across devices" onclose={() => ui.closeSettings()}>
    <p class="mb-4 text-base-content/65">
        Your playlists are saved in a SQLite database in this browser. Connect the sync API to back them up and keep
        your devices in step.
    </p>
    <form onsubmit={save}>
        <fieldset class="fieldset">
            <legend class="fieldset-legend">API address</legend>
            <input
                id="api-url"
                class="input w-full"
                bind:value={apiUrl}
                placeholder="/api"
                autocomplete="off"
                spellcheck="false"
                aria-label="API address"
            />
            <p class="label whitespace-normal">
                Keep <code>/api</code>: the Netlify site forwards it to the API.
            </p>
        </fieldset>

        <fieldset class="fieldset">
            <legend class="fieldset-legend">Sync token</legend>
            <div class="join w-full">
                <input
                    id="sync-token"
                    class="input join-item min-w-0 flex-1"
                    type={showToken ? 'text' : 'password'}
                    bind:value={token}
                    placeholder="The SYNC_TOKEN set on the API"
                    autocomplete="off"
                    spellcheck="false"
                    aria-label="Sync token"
                />
                <button class="btn join-item" type="button" onclick={() => (showToken = !showToken)}
                    >{showToken ? 'Hide' : 'Show'}</button
                >
            </div>
        </fieldset>

        <label class="label mt-3 cursor-pointer gap-3 text-sm text-base-content">
            <input type="checkbox" class="toggle toggle-primary toggle-sm" bind:checked={autoSync} />
            Sync automatically after changes and every minute
        </label>

        {#if result}
            <div
                class="alert alert-soft mt-4 py-2 text-sm"
                class:alert-success={result.ok}
                class:alert-error={!result.ok}
                role="status"
            >
                {result.message}
            </div>
        {/if}

        <div class="modal-action">
            <button class="btn" type="button" onclick={test} disabled={testing}>
                {#if testing}<span class="loading loading-spinner loading-xs"></span> Checking…{:else}Test connection{/if}
            </button>
            <button class="btn btn-primary" type="submit">Save and sync</button>
        </div>
    </form>

    <div class="divider my-4"></div>
    <div class="flex items-center justify-between gap-4 text-sm text-base-content/65">
        <p>Download a copy of everything as a SQLite file.</p>
        <button class="btn btn-ghost btn-sm" type="button" onclick={exportDatabase}>
            <Icon name="download" size={16} /> Export database
        </button>
    </div>
</Dialog>

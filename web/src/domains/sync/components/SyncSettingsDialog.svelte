<script>
    import { untrack } from 'svelte';
    import Dialog from '../../../shared/components/Dialog.svelte';
    import Icon from '../../../shared/components/Icon.svelte';
    import { getDatabase } from '../../../core/db/index.js';
    import { sync } from '../sync.service.svelte.js';
    import { ui } from '../../ui/ui.service.svelte.js';
    import { ChainCodeError, WORD_COUNT, defaultDeviceName, splitWords, wordsToSecret } from '../chain-code.js';
    import { RECOVERY_CODE_LENGTH, isRecoveryCode, recoveryCodeProblem } from '../recovery-code.js';
    import ChainActivity from './ChainActivity.svelte';
    import ChainCodeStep from './ChainCodeStep.svelte';
    import ChainDevices from './ChainDevices.svelte';

    let apiUrl = $state('/api');
    let autoSync = $state(true);
    let deviceName = $state('');
    let mode = $state('choose'); // 'choose' | 'join' | 'recover'
    let codeText = $state('');
    let recoveryText = $state('');
    let testing = $state(false);
    let result = $state(null);
    let confirming = $state(null); // 'replace' | 'codes' | 'leave' | 'delete'
    let lostCodes = $state(false);

    // Load the saved values each time the dialog opens.
    $effect(() => {
        if (!ui.settingsOpen) return;
        untrack(() => {
            const s = $state.snapshot(sync.settings);
            apiUrl = s.apiUrl;
            autoSync = s.autoSync;
            deviceName = defaultDeviceName();
            mode = 'choose';
            codeText = '';
            recoveryText = '';
            result = null;
            confirming = null;
            lostCodes = false;
            sync.loadChain();
            sync.loadEvents();
        });
    });

    const recoveryProblem = $derived(recoveryCodeProblem(recoveryText));

    const typedWords = $derived(splitWords(codeText).length);
    const codeProblem = $derived.by(() => {
        if (typedWords < WORD_COUNT) return '';
        try {
            wordsToSecret(codeText);
            return '';
        } catch (err) {
            return err instanceof ChainCodeError ? err.message : 'That code can’t be read.';
        }
    });

    const test = async () => {
        testing = true;
        result = await sync.testConnection({ apiUrl });
        testing = false;
    };

    const saveConnection = (event) => {
        event.preventDefault();
        sync.saveSettings({ apiUrl, autoSync });
        result = { ok: true, message: 'Saved.' };
    };

    const join = async (event) => {
        event.preventDefault();
        if (await sync.joinChain(codeText, deviceName)) codeText = '';
    };

    const recover = async (event) => {
        event.preventDefault();
        if (await sync.recoverChain(recoveryText, deviceName)) recoveryText = '';
    };

    const confirmThen = async (action, work) => {
        if (confirming !== action) {
            confirming = action;
            return;
        }
        confirming = null;
        await work();
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
    {#if sync.newCode}
        <ChainCodeStep code={sync.newCode} ondone={() => sync.codeSaved()} />
    {:else if sync.configured}
        <p class="mb-4 text-sm text-base-content/65">
            This device is in a sync chain: your playlists sync with the other devices in it.
        </p>

        {#if sync.recoveryNotice}
            <div class="alert alert-warning alert-soft mb-4 items-start text-sm" role="status">
                <Icon name="info" size={18} />
                <div>
                    <p class="font-semibold">Add another device or recovery codes so you don’t lose access</p>
                    <p class="mt-1">
                        This is the only device in the chain, and the chain has no recovery codes. If you lose this
                        device and the code, nobody can get the chain back.
                    </p>
                    <button
                        class="btn btn-sm mt-2"
                        type="button"
                        disabled={sync.busy}
                        onclick={() => sync.renewRecoveryCodes()}
                    >
                        Create recovery codes
                    </button>
                </div>
            </div>
        {:else if sync.checkInDue}
            <div class="alert alert-info alert-soft mb-4 items-start text-sm" role="status">
                <Icon name="info" size={18} />
                <div>
                    <p class="font-semibold">Do you still have your sync chain code and recovery codes?</p>
                    {#if lostCodes}
                        <p class="mt-1">
                            Make new ones now, while this device is still in the chain. New recovery codes are enough to
                            get back in; a new code is needed to add another device.
                        </p>
                        <div class="mt-2 flex flex-wrap gap-2">
                            <button
                                class="btn btn-sm"
                                type="button"
                                disabled={sync.busy}
                                onclick={async () => (await sync.renewRecoveryCodes()) && sync.confirmCodeCheckIn()}
                            >
                                New recovery codes
                            </button>
                            <button
                                class="btn btn-sm btn-ghost"
                                type="button"
                                onclick={() => {
                                    lostCodes = false;
                                    confirming = 'replace';
                                }}
                            >
                                A new code…
                            </button>
                        </div>
                    {:else}
                        <p class="mt-1">Without them, a lost device can’t get back into the chain.</p>
                        <div class="mt-2 flex flex-wrap gap-2">
                            <button class="btn btn-sm" type="button" onclick={() => sync.confirmCodeCheckIn()}>
                                Yes, I have them
                            </button>
                            <button class="btn btn-sm btn-ghost" type="button" onclick={() => (lostCodes = true)}>
                                No
                            </button>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}

        <ChainDevices />

        <div class="mt-4 flex flex-wrap gap-2">
            <button
                class="btn btn-sm"
                class:btn-warning={confirming === 'replace'}
                type="button"
                disabled={sync.busy}
                onclick={() => confirmThen('replace', () => sync.replaceCode())}
            >
                {confirming === 'replace' ? 'Yes, new code and remove other devices' : 'Generate a new code'}
            </button>
            <button
                class="btn btn-sm"
                class:btn-warning={confirming === 'codes'}
                type="button"
                disabled={sync.busy}
                onclick={() => confirmThen('codes', () => sync.renewRecoveryCodes())}
            >
                {confirming === 'codes' ? 'Yes, new recovery codes' : 'Generate new recovery codes'}
            </button>
            <button
                class="btn btn-sm btn-ghost"
                class:btn-warning={confirming === 'leave'}
                type="button"
                disabled={sync.busy}
                onclick={() => confirmThen('leave', () => sync.leaveChain())}
            >
                {confirming === 'leave' ? 'Yes, leave' : 'Leave this chain'}
            </button>
            <button
                class="btn btn-sm btn-ghost"
                class:btn-error={confirming === 'delete'}
                type="button"
                disabled={sync.busy}
                onclick={() => confirmThen('delete', () => sync.deleteChain())}
            >
                {confirming === 'delete' ? 'Yes, delete it for every device' : 'Delete the sync chain'}
            </button>
        </div>
        {#if confirming === 'replace'}
            <p class="mt-2 text-sm text-warning" role="alert">
                The current code and recovery codes stop working and every other device is removed; add them again with
                the new code. Use this if the code leaked or a device was lost.
            </p>
        {:else if confirming === 'codes'}
            <p class="mt-2 text-sm text-warning" role="alert">
                The current recovery codes stop working. The chain code and the devices stay as they are.
            </p>
        {:else if confirming === 'leave'}
            <p class="mt-2 text-sm text-warning" role="alert">
                This device stops syncing. Its playlists stay here, and the other devices keep the chain.
            </p>
        {:else if confirming === 'delete'}
            <p class="mt-2 text-sm text-error" role="alert">
                Deletes the chain and the server’s copy of its playlists, and removes every device. Playlists on each
                device stay on that device.
            </p>
        {/if}

        <ChainActivity />
    {:else}
        <p class="mb-4 text-sm text-base-content/65">
            Your playlists are saved in a SQLite database in this browser. A <strong>sync chain</strong> keeps your devices
            in step: create one here, then join it on your other devices with its 24-word code. No account or password needed.
        </p>

        <label class="fieldset mb-3">
            <span class="fieldset-legend">This device’s name</span>
            <input class="input w-full" bind:value={deviceName} maxlength="100" autocomplete="off" />
        </label>

        {#if sync.settings.legacyToken}
            <div class="alert alert-info alert-soft mb-3 items-start text-sm">
                <Icon name="info" size={18} />
                <div>
                    <p class="font-semibold">Your synced playlists can become a sync chain</p>
                    <p class="mt-1">
                        This device synced with the old shared sync token. Turn that library into a sync chain to keep
                        syncing it; you’ll get its code to add your other devices.
                    </p>
                    <button
                        class="btn btn-primary btn-sm mt-2"
                        type="button"
                        disabled={sync.busy}
                        onclick={() => sync.claimLegacyChain(deviceName)}
                    >
                        Turn it into a sync chain
                    </button>
                </div>
            </div>
        {/if}

        {#if mode === 'choose'}
            <div class="grid gap-3 sm:grid-cols-2">
                <button
                    class="btn btn-primary"
                    type="button"
                    disabled={sync.busy}
                    onclick={() => sync.createChain(deviceName)}
                >
                    {#if sync.busy}<span class="loading loading-spinner loading-xs"></span>{/if}
                    Create a sync chain
                </button>
                <button class="btn" type="button" disabled={sync.busy} onclick={() => (mode = 'join')}>
                    Join with a code
                </button>
            </div>
            <p class="mt-3 text-center text-sm text-base-content/65">
                Lost every device and the code?
                <button class="link" type="button" disabled={sync.busy} onclick={() => (mode = 'recover')}>
                    Recover with a recovery code
                </button>
            </p>
        {:else if mode === 'recover'}
            <form onsubmit={recover}>
                <label class="fieldset">
                    <span class="fieldset-legend">Recovery code</span>
                    <input
                        class="input w-full font-mono uppercase"
                        bind:value={recoveryText}
                        placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                        autocomplete="off"
                        autocapitalize="characters"
                        spellcheck="false"
                    />
                    <span class="label whitespace-normal" class:text-error={recoveryProblem}>
                        {recoveryProblem ||
                            `One of the ${RECOVERY_CODE_LENGTH}-character codes you saved with the chain code.`}
                    </span>
                </label>
                <p class="mt-2 text-sm text-warning">
                    The chain gets a new code and new recovery codes, every other device is removed, and this device
                    joins. Your playlists stay. The code you use stops working.
                </p>
                <div class="mt-3 flex justify-end gap-2">
                    <button class="btn btn-ghost" type="button" onclick={() => (mode = 'choose')}>Back</button>
                    <button class="btn btn-primary" type="submit" disabled={sync.busy || !isRecoveryCode(recoveryText)}>
                        {#if sync.busy}<span class="loading loading-spinner loading-xs"></span>{/if}
                        Recover
                    </button>
                </div>
            </form>
        {:else}
            <form onsubmit={join}>
                <label class="fieldset">
                    <span class="fieldset-legend">Sync chain code</span>
                    <textarea
                        class="textarea w-full font-mono text-sm"
                        rows="4"
                        bind:value={codeText}
                        placeholder="The 24 words, or paste the downloaded code file"
                        autocomplete="off"
                        autocapitalize="off"
                        spellcheck="false"></textarea>
                    <span class="label" class:text-error={codeProblem}>
                        {codeProblem || `${typedWords} of ${WORD_COUNT} words`}
                    </span>
                </label>
                <div class="mt-3 flex justify-end gap-2">
                    <button class="btn btn-ghost" type="button" onclick={() => (mode = 'choose')}>Back</button>
                    <button
                        class="btn btn-primary"
                        type="submit"
                        disabled={sync.busy || typedWords !== WORD_COUNT || Boolean(codeProblem)}
                    >
                        {#if sync.busy}<span class="loading loading-spinner loading-xs"></span>{/if}
                        Join
                    </button>
                </div>
            </form>
        {/if}
    {/if}

    {#if !sync.newCode}
        <details class="collapse-arrow collapse mt-4 rounded-box border border-base-300">
            <summary class="collapse-title py-2 text-sm font-semibold">Connection</summary>
            <form class="collapse-content" onsubmit={saveConnection}>
                <fieldset class="fieldset">
                    <legend class="fieldset-legend">API address</legend>
                    <input
                        class="input w-full"
                        bind:value={apiUrl}
                        placeholder="/api"
                        autocomplete="off"
                        spellcheck="false"
                        aria-label="API address"
                    />
                    <p class="label whitespace-normal">
                        Keep <code>/api</code>: the Netlify site forwards it to the API. Changing it leaves the current
                        sync chain.
                    </p>
                </fieldset>
                <label class="label mt-2 cursor-pointer gap-3 text-sm text-base-content">
                    <input type="checkbox" class="toggle toggle-primary toggle-sm" bind:checked={autoSync} />
                    Sync automatically after changes and every minute
                </label>
                {#if result}
                    <div
                        class="alert alert-soft mt-3 py-2 text-sm"
                        class:alert-success={result.ok}
                        class:alert-error={!result.ok}
                        role="status"
                    >
                        {result.message}
                    </div>
                {/if}
                <div class="mt-3 flex justify-end gap-2">
                    <button class="btn btn-sm" type="button" onclick={test} disabled={testing}>
                        {#if testing}<span class="loading loading-spinner loading-xs"></span> Checking…{:else}Test
                            connection{/if}
                    </button>
                    <button class="btn btn-sm btn-primary" type="submit">Save</button>
                </div>
            </form>
        </details>

        <div class="mt-4 flex items-center justify-between gap-4 text-sm text-base-content/65">
            <p>Download a copy of everything as a SQLite file.</p>
            <button class="btn btn-ghost btn-sm" type="button" onclick={exportDatabase}>
                <Icon name="download" size={16} /> Export database
            </button>
        </div>
    {/if}
</Dialog>

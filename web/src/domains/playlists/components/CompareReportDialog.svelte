<script>
    import Dialog from '../../../shared/components/Dialog.svelte';
    import Icon from '../../../shared/components/Icon.svelte';
    import { playlists } from '../playlists.service.svelte.js';

    /** Compares an old .txt report with the playlist and adds back what's missing. */
    let { playlist, open = false, onclose } = $props();

    const example = 'Total videos: 153\n1: Mariya Takeuchi - Plastic Love\n2: Anri - Windy Summer';

    let text = $state('');
    let fileName = $state('');
    let fileInput = $state();

    const result = $derived(text.trim() ? playlists.compareWithReport(playlist.id, text) : undefined);

    // Start fresh each time the dialog opens.
    $effect(() => {
        if (open) {
            text = '';
            fileName = '';
        }
    });

    const readFile = async (event) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (!file) return;
        fileName = file.name;
        text = await file.text();
        // Lets the same file be chosen again.
        input.value = '';
    };

    const add = () => {
        if (!result?.missing.length) return;
        playlists.addMissingFromReport(playlist.id, result.missing);
        onclose?.();
    };
</script>

<Dialog {open} title="Compare with a report" {onclose}>
    <p class="text-sm text-base-content/65">
        Load a report saved from this app (<code>1: title</code> per line) to find the videos this playlist no longer has.
        Missing items come back in their old place, and you can paste each one’s YouTube link later.
    </p>

    <div class="mt-4 flex flex-wrap items-center gap-3">
        <input bind:this={fileInput} class="hidden" type="file" accept=".txt,text/plain" onchange={readFile} />
        <button class="btn btn-sm" type="button" onclick={() => fileInput.click()}>
            <Icon name="upload" size={16} /> Choose a .txt file
        </button>
        <span class="min-w-0 truncate text-sm text-base-content/65">{fileName || 'or paste it below'}</span>
    </div>

    <label class="sr-only" for="report-text">Report text</label>
    <textarea
        id="report-text"
        class="textarea mt-3 w-full font-mono text-sm"
        rows="5"
        placeholder={example}
        bind:value={text}
        oninput={() => (fileName = '')}
        spellcheck="false"></textarea>

    {#if result === null}
        <p class="mt-3 text-sm text-error" role="alert">
            No numbered lines found. Each video needs a line like “12: title”.
        </p>
    {:else if result}
        <div class="stats stats-horizontal mt-3 w-full bg-base-200">
            <div class="stat px-4 py-2">
                <div class="stat-title">In the report</div>
                <div class="stat-value text-2xl">{result.total}</div>
            </div>
            <div class="stat px-4 py-2">
                <div class="stat-title">Still here</div>
                <div class="stat-value text-2xl">{result.found}</div>
            </div>
            <div class="stat px-4 py-2">
                <div class="stat-title">Missing</div>
                <div class="stat-value text-2xl" class:text-primary={result.missing.length}>
                    {result.missing.length}
                </div>
            </div>
        </div>

        {#if result.missing.length}
            <ol class="missing mt-3 rounded-box border border-base-300 text-sm" aria-label="Missing items">
                {#each result.missing as entry, i (i)}
                    <li class="flex gap-2 px-3 py-1.5">
                        <span class="w-10 flex-none text-right tabular-nums text-base-content/50">{entry.number}:</span>
                        <span class="min-w-0 break-words">{entry.title}</span>
                    </li>
                {/each}
            </ol>
        {:else}
            <p class="mt-3 text-sm">Nothing is missing: every item in the report is still in this playlist.</p>
        {/if}
    {/if}

    <div class="modal-action">
        <button class="btn btn-ghost" type="button" onclick={() => onclose?.()}>Cancel</button>
        <button class="btn btn-primary" type="button" disabled={!result?.missing.length} onclick={add}>
            {result?.missing.length
                ? `Add ${result.missing.length} missing item${result.missing.length === 1 ? '' : 's'}`
                : 'Add missing items'}
        </button>
    </div>
</Dialog>

<style lang="scss">
    .missing {
        max-height: 14rem;
        overflow-y: auto;

        li + li {
            border-top: 1px solid var(--color-base-300);
        }
    }
</style>

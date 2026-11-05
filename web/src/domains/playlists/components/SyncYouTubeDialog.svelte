<script>
    import { untrack } from 'svelte';
    import Dialog from '../../../shared/components/Dialog.svelte';
    import Icon from '../../../shared/components/Icon.svelte';
    import { playlists } from '../playlists.service.svelte.js';
    import { hasChanges } from '@ytpm/core/playlists/youtube-sync';
    import { listProblem, parsePlaylistId } from '@ytpm/core/videos/youtube';

    /**
     * Everything about a playlist's YouTube playlist in one place: linking it
     * (or changing and removing the link), and syncing from it. YouTube is only
     * read when the person asks, and nothing changes until they review and apply,
     * since a sync can remove videos here.
     */
    let { playlist, open = false, onclose } = $props();

    let source = $state(null);
    let reading = $state(false);
    let failed = $state(false);
    let editingLink = $state(false);
    let link = $state('');
    let includeUnavailable = $state(false);
    let removeMissing = $state(false);
    let saveReport = $state(true);
    let confirmingRemoval = $state(false);

    const linked = $derived(playlist.source === 'youtube' && Boolean(playlist.sourceId));
    const diff = $derived(source ? playlists.compareWithYouTube(playlist.id, source, { includeUnavailable }) : null);
    const changes = $derived(diff ? hasChanges(diff, { removeMissing }) : false);
    // Nothing differs at all, not even removals the person chose to keep.
    const inStep = $derived(diff ? !hasChanges(diff, { removeMissing: true }) : false);
    const removing = $derived(diff && removeMissing ? diff.removed.length : 0);
    const youtubeUrl = $derived(`https://www.youtube.com/playlist?list=${playlist.sourceId}`);

    // Start fresh each time the dialog opens. Only `open` is tracked.
    $effect(() => {
        if (!open) return;
        untrack(() => {
            source = null;
            reading = false;
            failed = false;
            editingLink = false;
            link = '';
            includeUnavailable = false;
            removeMissing = false;
            saveReport = true;
            confirmingRemoval = false;
        });
    });

    // Ticking or unticking removal asks for the confirmation again.
    $effect(() => {
        removeMissing;
        untrack(() => (confirmingRemoval = false));
    });

    const compare = async () => {
        reading = true;
        failed = false;
        source = await playlists.readLinkedYouTubePlaylist(playlist.id);
        failed = source === null;
        reading = false;
    };

    const saveLink = (event) => {
        event.preventDefault();
        if (!playlists.linkToYouTube(playlist.id, link)) return;
        link = '';
        editingLink = false;
        source = null;
    };

    const unlink = () => {
        if (!playlists.linkToYouTube(playlist.id, '')) return;
        source = null;
    };

    const apply = () => {
        if (!diff || !changes) return;
        if (removing && !confirmingRemoval) {
            confirmingRemoval = true;
            return;
        }
        playlists.applyYouTubeSync(playlist.id, diff, { removeMissing, saveReport });
        onclose?.();
    };

    const label = (video) => video.title || `YouTube video ${video.youtubeId}`;
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
</script>

<Dialog {open} title="Sync from YouTube" {onclose}>
    {#if !linked || editingLink}
        <p class="text-sm text-base-content/65">
            {linked
                ? 'Paste the YouTube playlist this one should be linked to instead.'
                : "This playlist isn't linked to a YouTube playlist yet. Paste the one it came from to compare them."}
        </p>
        <form class="join mt-4 w-full" onsubmit={saveLink}>
            <label class="sr-only" for="sync-link">YouTube playlist link or ID</label>
            <input
                id="sync-link"
                class="input join-item min-w-0 flex-1"
                bind:value={link}
                placeholder="https://www.youtube.com/playlist?list=…"
                autocomplete="off"
                spellcheck="false"
                inputmode="url"
            />
            <button class="btn btn-primary join-item" type="submit" disabled={!parsePlaylistId(link)}>Link</button>
        </form>
        {#if link.trim() && !parsePlaylistId(link)}
            <p class="mt-2 text-sm text-error" role="alert">
                {listProblem(link) ?? "That isn't a YouTube playlist link or ID"}.
            </p>
        {/if}
        {#if editingLink}
            <button class="btn btn-ghost btn-sm mt-3" type="button" onclick={() => (editingLink = false)}>
                Keep the current link
            </button>
        {/if}
    {:else}
        <div class="linked flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span class="min-w-0">
                Linked to
                <a class="link" href={youtubeUrl} target="_blank" rel="noopener noreferrer"
                    >{source?.title ? `“${source.title}”` : playlist.sourceId}</a
                >
            </span>
            <span class="flex gap-1">
                <button class="btn btn-ghost btn-xs" type="button" onclick={() => (editingLink = true)}>Change</button>
                <button class="btn btn-ghost btn-xs" type="button" onclick={unlink}>Unlink</button>
            </span>
        </div>

        {#if reading}
            <p class="flex items-center gap-2 py-6 text-sm text-base-content/65">
                <span class="loading loading-spinner loading-sm"></span> Reading the playlist from YouTube…
            </p>
        {:else if !diff}
            <div role="alert" class="alert alert-warning alert-soft mt-4 items-start text-sm">
                <Icon name="info" size={18} />
                <div>
                    <p class="font-semibold">Syncing makes this playlist follow YouTube.</p>
                    <p class="mt-1">
                        It can add videos, mark videos deleted on YouTube as Missing, and, if you choose, remove videos
                        that are no longer in the YouTube playlist, along with their notes and watched marks. Compare
                        first: nothing changes until you review and apply.
                    </p>
                </div>
            </div>
            {#if failed}
                <p class="mt-3 text-sm text-error">Couldn't read the YouTube playlist. Try again.</p>
            {/if}
        {:else}
            {#if !diff.complete}
                <div role="alert" class="alert alert-warning alert-soft mt-3 text-sm">
                    YouTube only returned part of this playlist (set YOUTUBE_API_KEY on the API to read all of it), so
                    videos removed there can't be detected. New videos can still be added.
                </div>
            {/if}

            <div class="sections mt-3 space-y-2">
                {#snippet section(title, items, hint)}
                    <details class="collapse-arrow collapse rounded-box border border-base-300" open={items.length > 0}>
                        <summary class="collapse-title py-2 text-sm font-semibold">
                            {title} <span class="badge badge-sm ml-1">{items.length}</span>
                        </summary>
                        <div class="collapse-content text-sm">
                            {#if hint}<p class="mb-1 text-base-content/65">{hint}</p>{/if}
                            <ul class="list">
                                {#each items as item, i (i)}
                                    <li class="truncate py-0.5">
                                        {label(item)}{#if item.unavailable}<span class="text-base-content/65">
                                                · deleted on YouTube</span
                                            >{/if}
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    </details>
                {/snippet}

                {@render section('New on YouTube', diff.added, "Added in YouTube's order.")}
                {@render section(
                    'Deleted or private on YouTube',
                    diff.nowUnavailable,
                    'Kept, and marked as Missing so you can paste another link.',
                )}
                {#if diff.availableAgain.length}
                    {@render section('Back on YouTube', diff.availableAgain, 'No longer marked as deleted.')}
                {/if}
                {#if diff.complete}
                    {@render section(
                        'Removed from the YouTube playlist',
                        diff.removed,
                        'Kept here unless you choose below.',
                    )}
                {/if}
            </div>

            <div class="mt-4 space-y-2 text-sm">
                <label class="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" class="checkbox checkbox-sm" bind:checked={includeUnavailable} />
                    Import with deleted videos (as Missing items)
                </label>
                {#if diff.complete && diff.removed.length}
                    <label class="flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            class="checkbox checkbox-sm checkbox-error"
                            bind:checked={removeMissing}
                        />
                        Remove the {plural(diff.removed.length, 'video')} removed on YouTube from this playlist too
                    </label>
                {/if}
                <label class="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" class="checkbox checkbox-sm" bind:checked={saveReport} />
                    Save a report before applying
                </label>
            </div>

            {#if confirmingRemoval}
                <p class="mt-3 text-sm text-error" role="alert">
                    This removes {plural(removing, 'video')} from this playlist, with their notes and watched marks.
                    {saveReport ? 'The report saved first still lists them.' : ''}
                </p>
            {/if}
        {/if}
    {/if}

    <div class="modal-action">
        <button class="btn btn-ghost" type="button" onclick={() => onclose?.()}>Cancel</button>
        {#if linked && !editingLink && !diff}
            <button class="btn btn-primary" type="button" disabled={reading} onclick={compare}>
                <Icon name="sync" size={16} /> Compare with YouTube
            </button>
        {:else if diff && !editingLink}
            <button
                class="btn"
                class:btn-primary={!confirmingRemoval}
                class:btn-error={confirmingRemoval}
                type="button"
                disabled={!changes}
                onclick={apply}
            >
                {#if inStep}
                    Already in step
                {:else if confirmingRemoval}
                    Remove {plural(removing, 'video')} and apply
                {:else}
                    Apply
                {/if}
            </button>
        {/if}
    </div>
</Dialog>

<style lang="scss">
    .sections ul {
        max-height: 9rem;
        overflow-y: auto;
    }
</style>

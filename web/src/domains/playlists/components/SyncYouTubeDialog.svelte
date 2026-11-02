<script>
    import { untrack } from 'svelte';
    import Dialog from '../../../shared/components/Dialog.svelte';
    import Icon from '../../../shared/components/Icon.svelte';
    import { playlists } from '../playlists.service.svelte.js';
    import { hasChanges } from '../youtube-sync.js';
    import { parsePlaylistId } from '../../videos/youtube.js';

    /**
     * Brings a playlist in step with its YouTube playlist: reads YouTube, shows
     * what's new, deleted and removed there, and applies only what the person confirms.
     */
    let { playlist, open = false, onclose } = $props();

    let source = $state(null);
    let link = $state('');
    let includeUnavailable = $state(false);
    let removeMissing = $state(false);
    let saveReport = $state(true);

    const linked = $derived(playlist.source === 'youtube' && Boolean(playlist.sourceId));
    const diff = $derived(source ? playlists.compareWithYouTube(playlist.id, source, { includeUnavailable }) : null);
    const changes = $derived(diff ? hasChanges(diff, { removeMissing }) : false);
    // Nothing differs at all, not even removals the person chose to keep.
    const inStep = $derived(diff ? !hasChanges(diff, { removeMissing: true }) : false);

    const read = async () => {
        source = null;
        source = await playlists.readLinkedYouTubePlaylist(playlist.id);
    };

    // Start fresh, and read YouTube, each time the dialog opens. Only `open` is
    // tracked, so later changes to the playlists don't read YouTube again.
    $effect(() => {
        if (!open) return;
        untrack(() => {
            link = '';
            includeUnavailable = false;
            removeMissing = false;
            saveReport = true;
            if (linked) read();
            else source = null;
        });
    });

    const linkAndRead = (event) => {
        event.preventDefault();
        if (playlists.linkToYouTube(playlist.id, link)) read();
    };

    const apply = () => {
        if (!diff || !changes) return;
        playlists.applyYouTubeSync(playlist.id, diff, { removeMissing, saveReport });
        onclose?.();
    };

    const label = (video) => video.title || `YouTube video ${video.youtubeId}`;
</script>

<Dialog {open} title="Sync from YouTube" {onclose}>
    {#if !linked}
        <p class="text-sm text-base-content/65">
            This playlist isn’t linked to a YouTube playlist yet. Paste the one it came from to compare them.
        </p>
        <form class="join mt-4 w-full" onsubmit={linkAndRead}>
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
    {:else if playlists.syncing}
        <p class="flex items-center gap-2 py-6 text-sm text-base-content/65">
            <span class="loading loading-spinner loading-sm"></span> Reading the playlist from YouTube…
        </p>
    {:else if !diff}
        <p class="py-4 text-sm">Couldn’t read the YouTube playlist.</p>
        <button class="btn btn-sm" type="button" onclick={read}><Icon name="sync" size={16} /> Try again</button>
    {:else}
        <p class="text-sm text-base-content/65">
            Compared with
            <a
                class="link"
                href="https://www.youtube.com/playlist?list={playlist.sourceId}"
                target="_blank"
                rel="noopener noreferrer">“{source.title || playlist.sourceId}”</a
            >
            on YouTube. Nothing changes until you apply.
        </p>

        {#if !diff.complete}
            <div role="alert" class="alert alert-warning alert-soft mt-3 text-sm">
                YouTube only returned part of this playlist (set YOUTUBE_API_KEY on the API to read all of it), so
                videos removed there can’t be detected. New videos can still be added.
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

            {@render section('New on YouTube', diff.added, 'Added in YouTube’s order.')}
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
                    <input type="checkbox" class="checkbox checkbox-sm" bind:checked={removeMissing} />
                    Remove the {diff.removed.length} video{diff.removed.length === 1 ? '' : 's'} removed on YouTube from this
                    playlist too
                </label>
            {/if}
            <label class="flex cursor-pointer items-center gap-2">
                <input type="checkbox" class="checkbox checkbox-sm" bind:checked={saveReport} />
                Save a report before applying
            </label>
        </div>
    {/if}

    <div class="modal-action">
        <button class="btn btn-ghost" type="button" onclick={() => onclose?.()}>Cancel</button>
        <button class="btn btn-primary" type="button" disabled={!changes} onclick={apply}>
            {inStep ? 'Already in step' : 'Apply'}
        </button>
    </div>
</Dialog>

<style lang="scss">
    .sections ul {
        max-height: 9rem;
        overflow-y: auto;
    }
</style>

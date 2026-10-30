<script>
    import Icon from '../../../shared/components/Icon.svelte';
    import { videos } from '../videos.service.svelte.js';

    let { playlistId } = $props();

    const missingCount = $derived(videos.forPlaylist(playlistId).filter((v) => v.missing).length);

    // "Missing" only shows while there are placeholders waiting for a link.
    const filters = $derived([
        { id: 'all', label: 'All' },
        { id: 'unwatched', label: 'To watch' },
        { id: 'watched', label: 'Watched' },
        ...(missingCount || videos.filter === 'missing' ? [{ id: 'missing', label: `Missing (${missingCount})` }] : []),
    ]);
</script>

<div class="mb-3 mt-6 flex flex-wrap items-center justify-between gap-3">
    <div role="tablist" class="tabs tabs-box tabs-sm bg-base-300/60" aria-label="Show">
        {#each filters as f (f.id)}
            <button
                type="button"
                role="tab"
                aria-selected={videos.filter === f.id}
                class="tab font-semibold"
                class:tab-active={videos.filter === f.id}
                onclick={() => videos.setFilter(f.id)}>{f.label}</button
            >
        {/each}
    </div>
    <label class="input input-sm w-full sm:w-72">
        <Icon name="search" size={16} />
        <span class="sr-only">Search this playlist</span>
        <input type="search" class="grow" placeholder="Search titles, channels, notes" bind:value={videos.query} />
    </label>
</div>

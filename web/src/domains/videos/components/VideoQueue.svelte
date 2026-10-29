<script>
  import VideoRow from './VideoRow.svelte';
  import { videos } from '../videos.service.svelte.js';
  import { playlists } from '../../playlists/playlists.service.svelte.js';

  let { playlist } = $props();

  const all = $derived(videos.forPlaylist(playlist.id));
  const visible = $derived(videos.visibleFor(playlist.id));
  const otherPlaylists = $derived(playlists.items.filter((p) => p.id !== playlist.id));
  const orderOf = $derived(new Map(all.map((v, i) => [v.id, i])));
</script>

{#if all.length === 0}
  <div class="empty rounded-box border border-dashed border-base-300 px-6 py-10">
    <p class="font-display text-2xl font-bold tracking-tight">This playlist is empty.</p>
    <p class="mt-1 text-base-content/65">Paste a YouTube link above to add your first video. You can paste several at once.</p>
  </div>
{:else if visible.length === 0}
  <div class="empty rounded-box border border-dashed border-base-300 px-6 py-10">
    {#if videos.query}
      <p class="mb-4 font-display text-2xl font-bold tracking-tight">Nothing matches “{videos.query}”.</p>
      <button class="btn btn-sm" type="button" onclick={() => videos.setQuery('')}>Clear search</button>
    {:else if videos.filter === 'unwatched'}
      <p class="mb-4 font-display text-2xl font-bold tracking-tight">You’ve watched everything here.</p>
      <button class="btn btn-sm" type="button" onclick={() => videos.setFilter('all')}>Show all videos</button>
    {:else}
      <p class="mb-4 font-display text-2xl font-bold tracking-tight">Nothing watched yet.</p>
      <button class="btn btn-sm" type="button" onclick={() => videos.setFilter('all')}>Show all videos</button>
    {/if}
  </div>
{:else}
  <ol class="queue list rounded-box bg-base-100 shadow-sm">
    {#each visible as video (video.id)}
      {@const orderIndex = orderOf.get(video.id) ?? 0}
      <VideoRow
        {video}
        {orderIndex}
        number={orderIndex + 1}
        total={all.length}
        playing={video.id === videos.playingId}
        {otherPlaylists}
      />
    {/each}
  </ol>
{/if}

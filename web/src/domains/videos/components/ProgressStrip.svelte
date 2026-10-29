<script>
  import { videos as videoService } from '../videos.service.svelte.js';

  /** One segment per video: filled when watched, red while playing. */
  let { videos } = $props();

  const segmented = $derived(videos.length > 0 && videos.length <= 80);
  const watched = $derived(videos.filter((v) => v.watched).length);
</script>

{#if segmented}
  <div
    class="strip"
    role="progressbar"
    aria-label="Watched"
    aria-valuemin="0"
    aria-valuemax={videos.length}
    aria-valuenow={watched}
  >
    {#each videos as video (video.id)}
      <span class="seg" class:watched={video.watched} class:playing={video.id === videoService.playingId}></span>
    {/each}
  </div>
{:else}
  <!-- Long playlists (or empty ones) use daisyUI's progress bar. -->
  <progress
    class="progress progress-success flex-1"
    value={watched}
    max={Math.max(videos.length, 1)}
    aria-label="Watched"
  ></progress>
{/if}

<style lang="scss">
  @use 'tokens' as *;

  $height: 10px;
  $gap: 3px;

  .strip {
    display: flex;
    flex: 1;
    gap: $gap;
    height: $height;
  }

  .seg {
    flex: 1;
    min-width: 2px;
    border-radius: 2px;
    background: $base-300;
    transition: background-color $duration ease;

    &.watched {
      background: $success;
    }

    &.playing {
      background: $tally;
    }
  }
</style>

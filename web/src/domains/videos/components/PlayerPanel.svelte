<script>
  import Icon from '../../../shared/components/Icon.svelte';
  import { embedUrl } from '../youtube.js';
  import { videos } from '../videos.service.svelte.js';
</script>

{#if videos.playing}
  {@const video = videos.playing}
  <section class="player card mb-6 overflow-hidden bg-neutral text-neutral-content shadow-md" aria-label="Now playing">
    <figure class="frame">
      {#key video.youtubeId}
        <iframe
          src={embedUrl(video.youtubeId)}
          title={video.title || 'YouTube video'}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
      {/key}
    </figure>
    <div class="flex items-center gap-3 py-2.5 pl-4 pr-2.5">
      <p class="min-w-0 flex-1 truncate font-semibold">{video.title || video.youtubeId}</p>
      <button class="btn btn-primary btn-sm" type="button" onclick={() => videos.finishAndPlayNext()}>
        <Icon name="next" size={15} /> Watched, play next
      </button>
      <button class="btn btn-ghost btn-sm btn-square text-neutral-content" type="button" aria-label="Close player" onclick={() => videos.closePlayer()}>
        <Icon name="close" />
      </button>
    </div>
  </section>
{/if}

<style lang="scss">
  .frame {
    aspect-ratio: 16 / 9;
    max-height: 56vh;
    background: #000;

    iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
    }
  }
</style>

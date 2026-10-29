<script>
  import Icon from '../../../shared/components/Icon.svelte';
  import ProgressStrip from '../../videos/components/ProgressStrip.svelte';
  import { playlists } from '../playlists.service.svelte.js';
  import { videos as videoService } from '../../videos/videos.service.svelte.js';
  import { ui } from '../../ui/ui.service.svelte.js';

  let { playlist } = $props();

  const videos = $derived(videoService.forPlaylist(playlist.id));

  let name = $state('');
  let description = $state('');
  let confirming = $state(false);

  // Reset the editable fields whenever another playlist (or a synced edit) arrives.
  $effect(() => {
    name = playlist.name;
    description = playlist.description;
    confirming = false;
  });

  const watched = $derived(videos.filter((v) => v.watched).length);

  function saveName() {
    if (name.trim() && name.trim() !== playlist.name) playlists.rename(playlist.id, name);
    else name = playlist.name;
  }

  function saveDescription() {
    if (description.trim() !== playlist.description) playlists.describe(playlist.id, description);
  }

  function blurOnEnter(event) {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      name = playlist.name;
      description = playlist.description;
      event.currentTarget.blur();
    }
  }

  function remove() {
    if (!confirming) {
      confirming = true;
      setTimeout(() => (confirming = false), 4000);
      return;
    }
    playlists.remove(playlist.id);
  }
</script>

<header class="pb-5">
  <div class="flex items-center gap-2">
    <button
      class="btn btn-ghost btn-square -ml-2 md:hidden"
      type="button"
      aria-label="Show playlists"
      onclick={() => ui.toggleSidebar(true)}
    >
      <Icon name="menu" />
    </button>
    <label class="sr-only" for="playlist-name">Playlist name</label>
    <input
      id="playlist-name"
      class="title input input-ghost min-w-0 flex-1"
      bind:value={name}
      onblur={saveName}
      onkeydown={blurOnEnter}
      maxlength="200"
      autocomplete="off"
      spellcheck="false"
    />
    <button
      class="btn btn-sm"
      class:btn-ghost={!confirming}
      class:btn-error={confirming}
      class:btn-soft={confirming}
      type="button"
      onclick={remove}
      aria-label={confirming ? 'Confirm deleting this playlist' : 'Delete playlist'}
    >
      <Icon name="trash" size={16} />
      <span class={confirming ? '' : 'max-md:hidden'}>{confirming ? 'Delete it and its videos' : 'Delete'}</span>
    </button>
  </div>

  <label class="sr-only" for="playlist-description">Description</label>
  <input
    id="playlist-description"
    class="description input input-ghost input-sm w-full text-base-content/65"
    bind:value={description}
    onblur={saveDescription}
    onkeydown={blurOnEnter}
    placeholder="Add a description"
    maxlength="500"
    autocomplete="off"
  />

  <div class="mt-4 flex items-center gap-4">
    <ProgressStrip {videos} />
    <p class="tally flex-none text-sm tabular-nums text-base-content/65">
      {#if videos.length === 0}
        No videos yet
      {:else if watched === videos.length}
        All {videos.length} watched
      {:else}
        <strong class="font-display text-lg text-base-content">{videos.length - watched}</strong> left of {videos.length}
      {/if}
    </p>
  </div>
</header>

<style lang="scss">
  @use 'mixins' as *;

  // daisyUI inputs have a fixed field height; the title needs room for display type.
  .title {
    @include display(2.25rem);
    height: auto;
    margin-left: -0.75rem;
    padding-block: 0.15rem;

    @include until(md) {
      font-size: 1.5rem;
    }
  }

  .description {
    margin-left: -0.75rem;
    margin-top: 0.25rem;
  }
</style>

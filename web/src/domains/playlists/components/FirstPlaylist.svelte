<script>
  import { playlists } from '../playlists.service.svelte.js';
  import { ui } from '../../ui/ui.service.svelte.js';
  import Icon from '../../../shared/components/Icon.svelte';

  let name = $state('Watch later');

  function submit(event) {
    event.preventDefault();
    playlists.create(name);
  }
</script>

<section class="max-w-xl pt-[12vh]">
  <button class="btn btn-ghost btn-square -ml-2 mb-4 md:hidden" type="button" aria-label="Show playlists" onclick={() => ui.toggleSidebar(true)}>
    <Icon name="menu" />
  </button>
  <h1 class="display-title mb-3">Start your first playlist</h1>
  <p class="text-base-content/65">
    Save YouTube videos to watch later, in the order you want, with notes. Everything stays in this browser.
  </p>
  <form class="join mb-8 mt-6 w-full" onsubmit={submit}>
    <label class="sr-only" for="first-name">Playlist name</label>
    <input id="first-name" class="input input-lg join-item min-w-0 flex-1 text-base" bind:value={name} maxlength="200" autocomplete="off" />
    <button class="btn btn-primary btn-lg join-item text-base" type="submit" disabled={!name.trim()}>Create playlist</button>
  </form>
  <p class="text-sm text-base-content/65">
    Already using Queue on another device?
    <button class="link font-semibold text-base-content" type="button" onclick={() => ui.openSettings()}>Connect sync</button>
    to bring your playlists here.
  </p>
</section>

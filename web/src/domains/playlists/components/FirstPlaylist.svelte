<script>
    import { playlists } from '../playlists.service.svelte.js';
    import { ui } from '../../ui/ui.service.svelte.js';
    import Icon from '../../../shared/components/Icon.svelte';
    import { parsePlaylistId } from '../../videos/youtube.js';

    let name = $state('Watch later');

    const isLink = $derived(Boolean(parsePlaylistId(name)));

    const submit = (event) => {
        event.preventDefault();
        playlists.createFromInput(name);
    };
</script>

<section class="max-w-xl pt-[12vh]">
    <button
        class="btn btn-ghost btn-square -ml-2 mb-4 md:hidden"
        type="button"
        aria-label="Show playlists"
        onclick={() => ui.toggleSidebar(true)}
    >
        <Icon name="menu" />
    </button>
    <h1 class="display-title mb-3">Start your first playlist</h1>
    <p class="text-base-content/65">
        Save YouTube videos to watch later, in the order you want, with notes. Everything stays in this browser.
    </p>
    <form class="join mb-2 mt-6 w-full" onsubmit={submit}>
        <label class="sr-only" for="first-name">Playlist name or YouTube playlist link</label>
        <input
            id="first-name"
            class="input input-lg join-item min-w-0 flex-1 text-base"
            bind:value={name}
            maxlength="500"
            autocomplete="off"
            spellcheck="false"
            disabled={playlists.importing}
        />
        <button
            class="btn btn-primary btn-lg join-item text-base"
            type="submit"
            disabled={!name.trim() || playlists.importing}
        >
            {#if playlists.importing}
                <span class="loading loading-spinner loading-sm"></span> Importing…
            {:else}
                {isLink ? 'Import playlist' : 'Create playlist'}
            {/if}
        </button>
    </form>
    <p class="mb-8 text-sm text-base-content/65">
        Type a name, or paste a link to a YouTube playlist to bring in its videos.
    </p>
    <p class="text-sm text-base-content/65">
        Already using Queue on another device?
        <button class="link font-semibold text-base-content" type="button" onclick={() => ui.openSettings()}
            >Connect sync</button
        >
        to bring your playlists here.
    </p>
</section>

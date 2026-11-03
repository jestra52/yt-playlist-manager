<script>
    import Icon from '../../../shared/components/Icon.svelte';
    import LinkChoice from './LinkChoice.svelte';
    import { videos } from '../videos.service.svelte.js';
    import { extractYouTubeIds } from '../youtube.js';

    let { playlistId } = $props();
    let text = $state('');
    let wholePlaylists = $state(false);

    const inPlaylist = $derived(extractYouTubeIds(text).inPlaylist);

    const submit = async (event) => {
        event.preventDefault();
        if (!text.trim() || videos.importing) return;
        if (await videos.addFromText(text, playlistId, { wholePlaylists: inPlaylist > 0 && wholePlaylists })) {
            text = '';
            wholePlaylists = false;
        }
    };
</script>

<form class="join w-full" onsubmit={submit}>
    <label class="sr-only" for="add-videos">YouTube video or playlist links</label>
    <input
        id="add-videos"
        class="input input-lg join-item min-w-0 flex-1 text-base"
        bind:value={text}
        placeholder="Paste YouTube video or playlist links"
        autocomplete="off"
        spellcheck="false"
        inputmode="url"
        disabled={videos.importing}
    />
    <button
        class="btn btn-primary btn-lg join-item text-base"
        type="submit"
        disabled={!text.trim() || videos.importing}
    >
        {#if videos.importing}
            <span class="loading loading-spinner loading-sm"></span> Importing…
        {:else}
            <Icon name="plus" size={16} /> Add
        {/if}
    </button>
</form>
{#if inPlaylist > 0}
    <div class="mt-2 px-1">
        <LinkChoice
            bind:value={wholePlaylists}
            videoLabel={inPlaylist === 1 ? 'Add this video' : 'Add these videos'}
            playlistLabel={inPlaylist === 1 ? 'Add the whole playlist' : 'Add the whole playlists'}
            disabled={videos.importing}
        />
    </div>
{/if}

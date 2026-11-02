<script>
    import Dialog from '../../../shared/components/Dialog.svelte';
    import Icon from '../../../shared/components/Icon.svelte';
    import { playlists } from '../playlists.service.svelte.js';
    import { parsePlaylistId } from '../../videos/youtube.js';

    /** Links a playlist to its YouTube playlist, e.g. one imported before imports were remembered. */
    let { playlist, open = false, onclose } = $props();

    let link = $state('');

    const linked = $derived(playlist.source === 'youtube' && playlist.sourceId);
    const valid = $derived(Boolean(parsePlaylistId(link)));

    // Start fresh each time the dialog opens.
    $effect(() => {
        if (open) link = '';
    });

    const save = (event) => {
        event.preventDefault();
        if (playlists.linkToYouTube(playlist.id, link)) onclose?.();
    };

    const unlink = () => {
        if (playlists.linkToYouTube(playlist.id, '')) onclose?.();
    };
</script>

<Dialog {open} title="Link to a YouTube playlist" {onclose}>
    <p class="text-sm text-base-content/65">
        Remembers which YouTube playlist this one came from, so it can be synced with it. Nothing changes in the
        playlist now.
    </p>

    {#if linked}
        <p class="mt-4 text-sm">
            Linked to
            <a
                class="link font-mono"
                href="https://www.youtube.com/playlist?list={playlist.sourceId}"
                target="_blank"
                rel="noopener noreferrer">{playlist.sourceId}</a
            >
        </p>
    {/if}

    <form id="link-youtube" class="mt-4" onsubmit={save}>
        <label class="mb-1 block text-sm font-medium" for="youtube-playlist-link">
            {linked ? 'Link to another YouTube playlist' : 'YouTube playlist link or ID'}
        </label>
        <input
            id="youtube-playlist-link"
            class="input w-full"
            bind:value={link}
            placeholder="https://www.youtube.com/playlist?list=…"
            autocomplete="off"
            spellcheck="false"
            inputmode="url"
        />
        {#if link.trim() && !valid}
            <p class="mt-2 text-sm text-error" role="alert">That isn’t a YouTube playlist link or ID.</p>
        {/if}
    </form>

    <div class="modal-action">
        {#if linked}
            <button class="btn btn-ghost mr-auto" type="button" onclick={unlink}>
                <Icon name="close" size={16} /> Unlink
            </button>
        {/if}
        <button class="btn btn-ghost" type="button" onclick={() => onclose?.()}>Cancel</button>
        <button class="btn btn-primary" type="submit" form="link-youtube" disabled={!valid}>
            {linked ? 'Change link' : 'Link'}
        </button>
    </div>
</Dialog>

<script>
    import Icon from '../../../shared/components/Icon.svelte';
    import { videos } from '../videos.service.svelte.js';

    let { playlistId } = $props();
    let text = $state('');

    async function submit(event) {
        event.preventDefault();
        if (!text.trim() || videos.importing) return;
        if (await videos.addFromText(text, playlistId)) text = '';
    }
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

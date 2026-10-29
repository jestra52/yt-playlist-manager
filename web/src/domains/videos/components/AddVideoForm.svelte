<script>
    import Icon from '../../../shared/components/Icon.svelte';
    import { videos } from '../videos.service.svelte.js';

    let { playlistId } = $props();
    let text = $state('');

    function submit(event) {
        event.preventDefault();
        if (!text.trim()) return;
        if (videos.addFromText(text, playlistId)) text = '';
    }
</script>

<form class="join w-full" onsubmit={submit}>
    <label class="sr-only" for="add-videos">YouTube links</label>
    <input
        id="add-videos"
        class="input input-lg join-item min-w-0 flex-1 text-base"
        bind:value={text}
        placeholder="Paste YouTube links, one or many"
        autocomplete="off"
        spellcheck="false"
        inputmode="url"
    />
    <button class="btn btn-primary btn-lg join-item text-base" type="submit" disabled={!text.trim()}>
        <Icon name="plus" size={16} /> Add
    </button>
</form>

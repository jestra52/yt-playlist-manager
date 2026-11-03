<script>
    let { value = $bindable(false), videoLabel, playlistLabel, disabled = false, size = 'sm' } = $props();
</script>

<fieldset class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" {disabled}>
    <legend class="sr-only">This link is from a playlist</legend>
    <span class="opacity-70">This link is from a playlist:</span>
    <label class="flex cursor-pointer items-center gap-1.5">
        <input
            type="radio"
            class={size === 'xs' ? 'radio radio-xs' : 'radio radio-sm'}
            bind:group={value}
            value={false}
        />
        {videoLabel}
    </label>
    <label class="flex cursor-pointer items-center gap-1.5">
        <input
            type="radio"
            class={size === 'xs' ? 'radio radio-xs' : 'radio radio-sm'}
            bind:group={value}
            value={true}
        />
        {playlistLabel}
    </label>
</fieldset>

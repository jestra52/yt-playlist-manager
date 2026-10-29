<script>
    import Icon from './Icon.svelte';

    /** daisyUI modal on the native <dialog> element (focus trap and Esc for free). */
    let { open = false, title, onclose, children } = $props();
    let dialog;

    $effect(() => {
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    });
</script>

<dialog
    bind:this={dialog}
    class="modal modal-bottom sm:modal-middle"
    onclose={() => open && onclose?.()}
    aria-labelledby="dialog-title"
>
    <div class="modal-box">
        <button
            class="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"
            type="button"
            onclick={() => onclose?.()}
            aria-label="Close"
        >
            <Icon name="close" size={16} />
        </button>
        <h2 id="dialog-title" class="font-display text-2xl font-bold tracking-tight mb-2 pr-10">{title}</h2>
        {@render children?.()}
    </div>
    <form method="dialog" class="modal-backdrop">
        <button tabindex="-1">Close</button>
    </form>
</dialog>

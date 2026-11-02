<script>
    import { sync } from '../sync.service.svelte.js';

    /** The devices in this device's sync chain, with Remove for the others. */
    const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    const when = (ms) => (ms ? formatter.format(new Date(ms)) : '—');

    let confirmingId = $state(null);

    const remove = async (id) => {
        if (confirmingId !== id) {
            confirmingId = id;
            setTimeout(() => confirmingId === id && (confirmingId = null), 4000);
            return;
        }
        confirmingId = null;
        await sync.removeDevice(id);
    };
</script>

<section aria-labelledby="chain-devices-title">
    <h3 id="chain-devices-title" class="mb-2 font-semibold">Devices in this sync chain</h3>
    {#if !sync.chain}
        <p class="flex items-center gap-2 text-sm text-base-content/65">
            <span class="loading loading-spinner loading-xs"></span> Loading devices…
        </p>
    {:else}
        <ul class="devices rounded-box border border-base-300 text-sm">
            {#each sync.chain.devices as device (device.id)}
                {@const current = device.id === sync.chain.deviceId}
                <li class="flex items-center gap-3 px-3 py-2">
                    <div class="min-w-0 flex-1">
                        <p class="truncate font-medium">
                            {device.name}{#if current}<span class="badge badge-sm badge-soft badge-primary ml-2"
                                    >This device</span
                                >{/if}
                        </p>
                        <p class="text-xs text-base-content/65">
                            Joined {when(device.createdAt)} · last seen {when(device.lastSeenAt)}
                        </p>
                    </div>
                    {#if !current}
                        <button
                            class="btn btn-sm"
                            class:btn-ghost={confirmingId !== device.id}
                            class:btn-error={confirmingId === device.id}
                            type="button"
                            disabled={sync.busy}
                            onclick={() => remove(device.id)}
                            aria-label={confirmingId === device.id
                                ? `Confirm removing ${device.name}`
                                : `Remove ${device.name}`}
                        >
                            {confirmingId === device.id ? 'Remove it' : 'Remove'}
                        </button>
                    {/if}
                </li>
            {/each}
        </ul>
        <p class="mt-1 text-xs text-base-content/65">
            A removed device stops syncing at once and keeps its playlists. It can join again with the chain code.
        </p>
    {/if}
</section>

<style lang="scss">
    .devices li + li {
        border-top: 1px solid var(--color-base-300);
    }
</style>

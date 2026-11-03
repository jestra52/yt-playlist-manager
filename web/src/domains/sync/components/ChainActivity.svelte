<script>
    import { sync } from '../sync.service.svelte.js';
    import { describeEvent } from '../chain-events.js';

    /** The chain's audit log: what happened and from which device. Never shows a secret. */
    const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<details class="collapse-arrow collapse mt-4 rounded-box border border-base-300">
    <summary class="collapse-title py-2 text-sm font-semibold">Activity</summary>
    <div class="collapse-content text-sm">
        {#if !sync.events}
            <p class="flex items-center gap-2 text-base-content/65">
                <span class="loading loading-spinner loading-xs"></span> Loading activity…
            </p>
        {:else if !sync.events.length}
            <p class="text-base-content/65">Nothing yet.</p>
        {:else}
            <ul class="events">
                {#each sync.events as event, i (i)}
                    <li class="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
                        <span>{describeEvent(event)}</span>
                        <time class="text-xs text-base-content/65" datetime={new Date(event.at).toISOString()}>
                            {formatter.format(new Date(event.at))}
                        </time>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</details>

<style lang="scss">
    .events li + li {
        border-top: 1px solid var(--color-base-300);
    }
</style>

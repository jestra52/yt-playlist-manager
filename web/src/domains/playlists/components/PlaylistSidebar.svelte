<script>
    import Icon from '../../../shared/components/Icon.svelte';
    import SyncStatus from '../../sync/components/SyncStatus.svelte';
    import ThemeSwitch from '../../ui/components/ThemeSwitch.svelte';
    import { playlists } from '../playlists.service.svelte.js';
    import { videos } from '../../videos/videos.service.svelte.js';
    import { ui } from '../../ui/ui.service.svelte.js';

    let creating = $state(false);
    let name = $state('');
    let input = $state();

    function startCreating() {
        creating = true;
        queueMicrotask(() => input?.focus());
    }

    function submit(event) {
        event.preventDefault();
        if (playlists.create(name)) {
            ui.toggleSidebar(false);
            name = '';
            creating = false;
        }
    }

    function cancel(event) {
        if (event.key === 'Escape') {
            name = '';
            creating = false;
        }
    }
</script>

<nav class="rack bg-neutral text-neutral-content flex min-h-full w-72 flex-col px-3 pb-4 pt-5" aria-label="Playlists">
    <div class="brand flex items-center gap-2 px-3 pb-5">
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="5" y="8" width="14" height="3.4" rx="1.7" fill="currentColor" />
            <rect x="5" y="14.3" width="14" height="3.4" rx="1.7" fill="currentColor" />
            <rect x="5" y="20.6" width="9" height="3.4" rx="1.7" fill="currentColor" />
            <path d="M20.5 17.5v8.5l7-4.25z" fill="var(--color-primary)" />
        </svg>
        <span>Queue</span>
    </div>

    <ul class="menu playlist-menu w-full gap-0.5 p-0">
        {#each playlists.items as playlist (playlist.id)}
            {@const count = videos.counts[playlist.id] ?? { total: 0, watched: 0 }}
            {@const active = playlist.id === playlists.selectedId}
            <li>
                <button
                    type="button"
                    class="item"
                    class:menu-active={active}
                    aria-current={active ? 'page' : undefined}
                    onclick={() => {
                        playlists.select(playlist.id);
                        ui.toggleSidebar(false);
                    }}
                >
                    <span class="name grow">{playlist.name}</span>
                    <span class="count" title="{count.total - count.watched} left to watch">
                        {count.total - count.watched}<span class="of">/{count.total}</span>
                    </span>
                </button>
            </li>
        {/each}
    </ul>

    {#if creating}
        <form class="join mt-2 w-full" onsubmit={submit}>
            <label class="sr-only" for="new-playlist">Playlist name</label>
            <input
                id="new-playlist"
                class="input input-sm join-item min-w-0 flex-1 text-base-content"
                bind:this={input}
                bind:value={name}
                onkeydown={cancel}
                maxlength="200"
                placeholder="Playlist name"
                autocomplete="off"
            />
            <button class="btn btn-primary btn-sm join-item" type="submit" disabled={!name.trim()}>Create</button>
        </form>
    {:else}
        <button type="button" class="new-btn btn btn-ghost btn-sm mt-2 justify-start" onclick={startCreating}>
            <Icon name="plus" size={16} /> New playlist
        </button>
    {/if}

    <div class="mt-auto pt-4">
        <SyncStatus />
        <ThemeSwitch />
    </div>
</nav>

<style lang="scss">
    @use 'tokens' as *;
    @use 'mixins' as *;

    .brand {
        @include display(1.35rem);
    }

    // daisyUI's menu-active uses the neutral color, which is this panel's
    // background, so the sidebar gets its own active and hover look.
    .playlist-menu {
        .item {
            display: flex;
            align-items: baseline;
            gap: 0.75rem;
            border-left: 3px solid transparent;
            border-radius: 0 $radius-field $radius-field 0;
            color: tint($neutral-content, 70%);

            &:hover {
                background: tint($neutral-content, 8%);
                color: $neutral-content;
            }

            &.menu-active {
                border-left-color: $tally;
                background: tint($neutral-content, 12%);
                color: $neutral-content;
                font-weight: 600;
            }
        }

        .name {
            @include truncate;
        }

        .count {
            flex: none;
            font-size: 0.8125rem;
            font-variant-numeric: tabular-nums;
        }

        .of {
            opacity: 0.6;
        }
    }

    .new-btn {
        border: 1px dashed tint($neutral-content, 35%);
        color: tint($neutral-content, 70%);
        font-weight: 500;

        &:hover {
            border-color: tint($neutral-content, 70%);
            background: transparent;
            color: $neutral-content;
        }
    }
</style>

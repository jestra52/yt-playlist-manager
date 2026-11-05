<script>
    import Icon from '../../../shared/components/Icon.svelte';
    import SyncStatus from '../../sync/components/SyncStatus.svelte';
    import ThemeSwitch from '../../ui/components/ThemeSwitch.svelte';
    import { playlists } from '../playlists.service.svelte.js';
    import { videos } from '../../videos/videos.service.svelte.js';
    import { ui } from '../../ui/ui.service.svelte.js';
    import { parsePlaylistId, videoInPlaylist } from '@ytpm/core/videos/youtube';
    import LinkChoice from '../../videos/components/LinkChoice.svelte';
    import { SOURCE_URL } from '../../../core/config.js';

    let creating = $state(false);
    let name = $state('');
    let input = $state();
    let withDeleted = $state(false);
    let wholePlaylist = $state(true);

    const fromList = $derived(Boolean(videoInPlaylist(name)));
    const isLink = $derived(Boolean(parsePlaylistId(name)) && (!fromList || wholePlaylist));

    const startCreating = () => {
        creating = true;
        queueMicrotask(() => input?.focus());
    };

    const submit = async (event) => {
        event.preventDefault();
        if (
            await playlists.createFromInput(name, {
                includeUnavailable: withDeleted,
                justVideo: fromList && !wholePlaylist,
            })
        ) {
            ui.toggleSidebar(false);
            name = '';
            creating = false;
        }
    };

    const cancel = (event) => {
        if (event.key === 'Escape') {
            name = '';
            creating = false;
        }
    };
</script>

<nav class="rack bg-neutral text-neutral-content flex min-h-full w-72 flex-col px-3 pb-4 pt-5" aria-label="Playlists">
    <div class="brand flex items-center gap-2 px-3 pb-5">
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="5" y="8" width="14" height="3.4" rx="1.7" fill="currentColor" />
            <rect x="5" y="14.3" width="14" height="3.4" rx="1.7" fill="currentColor" />
            <rect x="5" y="20.6" width="9" height="3.4" rx="1.7" fill="currentColor" />
            <path d="M20.5 17.5v8.5l7-4.25z" fill="var(--color-primary)" />
        </svg>
        <span class="flex flex-col">
            <span>Yuzu Tapes</span>
            <span class="brand-sub">Playlist Manager</span>
        </span>
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
                    <span class="name grow" title={playlist.name}>{playlist.name}</span>
                    <span class="count" title="{count.total - count.watched} left to watch">
                        {count.total - count.watched}<span class="of">/{count.total}</span>
                    </span>
                </button>
            </li>
        {/each}
    </ul>

    {#if creating}
        <form class="join mt-2 w-full" onsubmit={submit}>
            <label class="sr-only" for="new-playlist">Playlist name or YouTube playlist link</label>
            <input
                id="new-playlist"
                class="input input-sm join-item min-w-0 flex-1 text-base-content"
                bind:this={input}
                bind:value={name}
                onkeydown={cancel}
                maxlength="500"
                placeholder="Name or YouTube playlist link"
                autocomplete="off"
                spellcheck="false"
                disabled={playlists.importing}
            />
            <button
                class="btn btn-primary btn-sm join-item"
                type="submit"
                disabled={!name.trim() || playlists.importing}
            >
                {#if playlists.importing}
                    <span class="loading loading-spinner loading-xs"></span>
                    <span class="sr-only">Importing</span>
                {:else}
                    {isLink ? 'Import' : 'Create'}
                {/if}
            </button>
        </form>
        {#if fromList}
            <div class="mt-2 px-1">
                <LinkChoice
                    bind:value={wholePlaylist}
                    videoLabel="Just this video"
                    playlistLabel="Whole playlist"
                    size="xs"
                    disabled={playlists.importing}
                />
            </div>
        {/if}
        {#if isLink}
            <label class="with-deleted mt-2 flex items-center gap-2 px-1 text-sm">
                <input
                    type="checkbox"
                    class="checkbox checkbox-xs"
                    bind:checked={withDeleted}
                    disabled={playlists.importing}
                />
                Import with deleted videos
            </label>
        {/if}
    {:else}
        <button type="button" class="new-btn btn btn-ghost btn-sm mt-2 justify-start" onclick={startCreating}>
            <Icon name="plus" size={16} /> New playlist
        </button>
    {/if}

    <div class="mt-auto pt-4">
        <SyncStatus />
        <ThemeSwitch />
        <a class="source-link mt-2 block px-3 text-xs" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
            Source code · AGPL-3.0
        </a>
    </div>
</nav>

<style lang="scss">
    @use 'tokens' as *;
    @use 'mixins' as *;

    // The name is long for the 18rem sidebar: smaller type, two lines if needed.
    .brand {
        @include display(1.25rem);
        line-height: 1.1;
    }

    .brand-sub {
        font-family: inherit;
        font-size: 0.75rem;
        font-weight: 500;
        letter-spacing: 0.02em;
        opacity: 0.7;
    }

    // daisyUI's menu-active uses the neutral color, which is this panel's
    // background, so the sidebar gets its own active and hover look.
    .playlist-menu {
        // daisyUI's menu and its rows wrap, so a long name would widen its
        // row (and the longest one every row) and push the counts past the
        // panel edge.
        flex-wrap: nowrap;

        li {
            flex-wrap: nowrap;
        }

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
            min-width: 0;
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

    .source-link {
        color: tint($neutral-content, 55%);

        &:hover,
        &:focus-visible {
            color: $neutral-content;
            text-decoration: underline;
        }
    }

    .with-deleted {
        color: tint($neutral-content, 70%);
        cursor: pointer;
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

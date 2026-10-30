<script>
    import Icon from '../../../shared/components/Icon.svelte';
    import { watchUrl } from '../youtube.js';
    import { videos } from '../videos.service.svelte.js';

    let { video, number, orderIndex, total, playing = false, otherPlaylists = [] } = $props();

    let editingNotes = $state(false);
    let thumbFailed = $state(false);
    let draft = $state('');
    let notesField = $state();
    let moveMenu = $state();

    const displayTitle = $derived(video.title || (video.missing ? 'Untitled' : `YouTube video ${video.youtubeId}`));

    let link = $state('');
    let saving = $state(false);

    const completeWithLink = async (event) => {
        event.preventDefault();
        if (!link.trim() || saving) return;
        saving = true;
        try {
            if (await videos.complete(video.id, link)) link = '';
        } finally {
            saving = false;
        }
    };

    const openNotes = () => {
        draft = video.notes;
        editingNotes = true;
        queueMicrotask(() => notesField?.focus());
    };

    const closeNotes = () => {
        if (draft !== video.notes) videos.saveNotes(video.id, draft.trim());
        editingNotes = false;
    };

    const onNotesKey = (event) => {
        if (event.key === 'Escape') {
            draft = video.notes;
            editingNotes = false;
        }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) closeNotes();
    };

    const moveTo = (playlist) => {
        moveMenu.open = false;
        videos.moveToPlaylist(video.id, playlist);
    };
</script>

<li class="row list-row items-start" class:watched={video.watched} class:playing>
    <button
        type="button"
        class="mark btn btn-ghost btn-square btn-lg"
        aria-pressed={video.watched}
        aria-label={video.watched ? `Mark “${displayTitle}” as not watched` : `Mark “${displayTitle}” as watched`}
        title={video.watched ? 'Watched. Click to undo' : 'Mark as watched'}
        onclick={() => videos.setWatched(video.id, !video.watched)}
    >
        {#if video.watched}
            <span class="check"><Icon name="check" size={20} /></span>
        {:else}
            <span class="num" class:long={number >= 100} class:longer={number >= 1000}>{number}</span>
        {/if}
    </button>

    {#if video.missing}
        <div class="thumb missing-thumb" title="Not on YouTube yet: paste its link">
            <Icon name="link" size={22} />
            <span>Missing</span>
        </div>
    {:else}
        <button type="button" class="thumb" onclick={() => videos.play(video.id)} aria-label="Play {displayTitle}">
            {#if !thumbFailed}
                <img
                    src={video.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    width="320"
                    height="180"
                    onerror={() => (thumbFailed = true)}
                />
            {:else}
                <span class="placeholder"><Icon name="play" size={28} /></span>
            {/if}
            <span class="play"><Icon name="play" size={18} /></span>
        </button>
    {/if}

    <div class="body list-col-grow min-w-0">
        {#if video.missing}
            <p class="title">{displayTitle}</p>
            <form class="join mt-2 w-full max-w-xl" onsubmit={completeWithLink}>
                <label class="sr-only" for="link-{video.id}">YouTube link for {displayTitle}</label>
                <input
                    id="link-{video.id}"
                    class="input input-sm join-item min-w-0 flex-1"
                    bind:value={link}
                    placeholder="Paste the YouTube link to complete it"
                    autocomplete="off"
                    spellcheck="false"
                    inputmode="url"
                    disabled={saving}
                />
                <button class="btn btn-sm btn-primary join-item" type="submit" disabled={!link.trim() || saving}>
                    {#if saving}<span class="loading loading-spinner loading-xs"></span>{/if}
                    Save
                </button>
            </form>
        {:else}
            <a class="title link link-hover" href={watchUrl(video.youtubeId)} target="_blank" rel="noopener noreferrer"
                >{displayTitle}</a
            >
            {#if video.author}<p class="mt-0.5 text-sm text-base-content/65">{video.author}</p>{/if}
        {/if}

        {#if editingNotes}
            <textarea
                class="notes-field textarea textarea-sm mt-2 w-full"
                bind:this={notesField}
                bind:value={draft}
                onblur={closeNotes}
                onkeydown={onNotesKey}
                rows="3"
                maxlength="5000"
                placeholder="Why you saved it, timestamps, anything"></textarea>
        {:else if video.notes}
            <button type="button" class="notes" onclick={openNotes}>{video.notes}</button>
        {/if}
    </div>

    <div class="actions flex max-md:list-col-wrap">
        <button
            class="btn btn-ghost btn-square btn-sm"
            type="button"
            title="Move up"
            aria-label="Move up"
            disabled={orderIndex === 0}
            onclick={() => videos.reorder(video.id, orderIndex - 1)}
        >
            <Icon name="up" size={17} />
        </button>
        <button
            class="btn btn-ghost btn-square btn-sm"
            type="button"
            title="Move down"
            aria-label="Move down"
            disabled={orderIndex === total - 1}
            onclick={() => videos.reorder(video.id, orderIndex + 1)}
        >
            <Icon name="down" size={17} />
        </button>
        <button
            class="btn btn-ghost btn-square btn-sm"
            type="button"
            title="Notes"
            aria-label="Edit notes"
            onclick={openNotes}
        >
            <Icon name="note" size={17} />
        </button>
        {#if otherPlaylists.length}
            <details class="dropdown dropdown-end" bind:this={moveMenu}>
                <summary
                    class="btn btn-ghost btn-square btn-sm"
                    title="Move to another playlist"
                    aria-label="Move to playlist"
                >
                    <Icon name="move" size={17} />
                </summary>
                <ul class="menu dropdown-content z-10 w-56 rounded-box bg-base-100 p-2 shadow-lg">
                    <li class="menu-title">Move to</li>
                    {#each otherPlaylists as p (p.id)}
                        <li><button type="button" onclick={() => moveTo(p)}>{p.name}</button></li>
                    {/each}
                </ul>
            </details>
        {/if}
        <button
            class="btn btn-ghost btn-square btn-sm"
            type="button"
            title="Remove"
            aria-label="Remove from playlist"
            onclick={() => videos.remove(video.id)}
        >
            <Icon name="trash" size={17} />
        </button>
    </div>
</li>

<style lang="scss">
    @use 'tokens' as *;
    @use 'mixins' as *;

    .row {
        padding-inline: 0.75rem;

        &.playing {
            box-shadow: inset 3px 0 0 $tally;
        }
    }

    .mark {
        margin-top: 0.15rem;

        // daisyUI styles aria-pressed buttons as active; the check mark is enough.
        &[aria-pressed='true'] {
            background: transparent;
            border-color: transparent;
            box-shadow: none;
        }

        &:hover {
            background: tint($success, 12%);
            border-color: transparent;
        }
    }

    .num {
        @include display(1.75rem, 700);
        font-variant-numeric: tabular-nums;
        line-height: 1;
        // Never wrap "100" onto two lines; long numbers shrink to fit instead.
        white-space: nowrap;

        .mark:hover & {
            color: $success;
        }

        @include until(md) {
            font-size: 1.4rem;
        }

        // Three and four digits still fit the square button.
        &.long {
            font-size: 1.3rem;

            @include until(md) {
                font-size: 1.05rem;
            }
        }

        &.longer {
            font-size: 1rem;

            @include until(md) {
                font-size: 0.8rem;
            }
        }
    }

    .check {
        display: grid;
        place-items: center;
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 50%;
        background: $success;
        color: var(--color-success-content);
    }

    .thumb {
        position: relative;
        width: $thumb-width;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        border-radius: $radius-field;
        background: $base-300;
        cursor: pointer;

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        @include until(md) {
            width: $thumb-width-compact;
        }
    }

    .missing-thumb {
        display: grid;
        place-content: center;
        justify-items: center;
        gap: 0.2rem;
        border: 2px dashed $base-300;
        background: transparent;
        color: tint($base-content, 50%);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        cursor: default;
    }

    .placeholder {
        display: grid;
        place-items: center;
        height: 100%;
        color: tint($base-content, 40%);
    }

    .play {
        position: absolute;
        right: 0.4rem;
        bottom: 0.4rem;
        display: grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        background: $tally;
        color: var(--color-primary-content);
        @include reveal-on-hover('.thumb');

        .playing & {
            opacity: 1;
            transform: none;
        }
    }

    .title {
        @include line-clamp(2);
        font-size: 1.125rem;
        font-weight: 600;
        line-height: 1.3;

        @include until(md) {
            font-size: 1rem;
        }
    }

    .notes {
        display: block;
        width: 100%;
        margin-top: 0.5rem;
        padding: 0.35rem 0.6rem;
        border-left: 2px solid $base-300;
        color: tint($base-content, 70%);
        font-size: 0.875rem;
        text-align: left;
        white-space: pre-wrap;
        cursor: pointer;

        &:hover {
            border-left-color: tint($base-content, 45%);
        }
    }

    .actions {
        opacity: 0.6;
        transition: opacity $duration-fast ease;

        .row:hover &,
        &:focus-within {
            opacity: 1;
        }

        @include until(md) {
            opacity: 1;
        }
    }

    .watched {
        .title,
        .thumb img {
            opacity: 0.55;
        }
    }
</style>

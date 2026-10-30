<script>
    import { onMount } from 'svelte';
    import { bootstrap } from './app/bootstrap.js';
    import { playlists } from './domains/playlists/playlists.service.svelte.js';
    import { ui } from './domains/ui/ui.service.svelte.js';
    import PlaylistSidebar from './domains/playlists/components/PlaylistSidebar.svelte';
    import PlaylistHeader from './domains/playlists/components/PlaylistHeader.svelte';
    import FirstPlaylist from './domains/playlists/components/FirstPlaylist.svelte';
    import AddVideoForm from './domains/videos/components/AddVideoForm.svelte';
    import VideoToolbar from './domains/videos/components/VideoToolbar.svelte';
    import VideoQueue from './domains/videos/components/VideoQueue.svelte';
    import PlayerPanel from './domains/videos/components/PlayerPanel.svelte';
    import SyncSettingsDialog from './domains/sync/components/SyncSettingsDialog.svelte';
    import Notices from './domains/ui/components/Notices.svelte';

    let phase = $state('loading'); // 'loading' | 'ready' | 'failed'
    let failure = $state('');

    onMount(() => {
        bootstrap()
            .then(() => (phase = 'ready'))
            .catch((err) => {
                console.error(err);
                failure = err?.message ?? String(err);
                phase = 'failed';
            });
    });
</script>

{#if phase === 'loading'}
    <div class="grid min-h-screen place-content-center gap-3 text-center text-base-content/65" aria-busy="true">
        <span class="loading loading-spinner loading-md mx-auto"></span>
        Opening your playlists…
    </div>
{:else if phase === 'failed'}
    <div class="grid min-h-screen place-content-center p-8">
        <div role="alert" class="alert alert-error alert-soft max-w-lg flex-col items-start">
            <h1 class="font-display text-xl font-bold">The local database didn’t open</h1>
            <p>{failure}</p>
            <p>Private browsing or blocked site storage can cause this. Allow storage for this site and reload.</p>
        </div>
    </div>
{:else}
    <div class="drawer md:drawer-open">
        <input
            id="playlists-drawer"
            type="checkbox"
            class="drawer-toggle"
            checked={ui.sidebarOpen}
            onchange={(e) => ui.toggleSidebar(e.currentTarget.checked)}
        />
        <div class="drawer-content">
            <main class="px-4 pb-24 pt-5 sm:px-8 md:pt-10 lg:px-14">
                <div class="max-w-4xl">
                    {#if playlists.selected}
                        {@const playlist = playlists.selected}
                        <PlayerPanel />
                        <PlaylistHeader {playlist} />
                        <AddVideoForm playlistId={playlist.id} />
                        <VideoToolbar playlistId={playlist.id} />
                        <VideoQueue {playlist} />
                    {:else}
                        <FirstPlaylist />
                    {/if}
                </div>
            </main>
        </div>
        <div class="drawer-side z-30">
            <label for="playlists-drawer" aria-label="Close playlists" class="drawer-overlay"></label>
            <PlaylistSidebar />
        </div>
    </div>
    <SyncSettingsDialog />
{/if}

<Notices />

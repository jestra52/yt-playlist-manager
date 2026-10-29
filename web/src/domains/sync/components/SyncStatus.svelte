<script>
  import Icon from '../../../shared/components/Icon.svelte';
  import { timeAgo } from '../../../shared/time.js';
  import { sync } from '../sync.service.svelte.js';
  import { ui } from '../../ui/ui.service.svelte.js';

  // Re-render the relative time every 30s.
  let tick = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => (tick = Date.now()), 30_000);
    return () => clearInterval(id);
  });

  const configured = $derived(sync.configured);
  const syncing = $derived(sync.status === 'syncing');
  const tone = $derived(
    !configured ? '' : sync.status === 'error' ? 'status-error' : sync.pending > 0 ? 'status-warning' : 'status-success',
  );
  const label = $derived.by(() => {
    if (!configured) return 'Only on this device';
    if (syncing) return 'Syncing…';
    if (sync.status === 'error') return sync.offline ? 'Offline. Changes are saved here.' : 'Sync failed';
    if (sync.pending > 0) return `${sync.pending} change${sync.pending === 1 ? '' : 's'} to sync`;
    return `Synced ${timeAgo(sync.lastSyncedAt, tick)}`;
  });
</script>

<div class="sync-status flex gap-1 pt-3">
  <button
    type="button"
    class="summary btn btn-ghost btn-sm min-w-0 flex-1 justify-start gap-2 font-normal"
    onclick={() => ui.openSettings()}
    title={sync.error ?? 'Sync settings'}
  >
    <span class="status {tone}" class:animate-pulse={syncing} aria-hidden="true"></span>
    <span class="text grow truncate text-left">{label}</span>
    <Icon name="settings" size={16} />
  </button>
  {#if configured}
    <button
      type="button"
      class="now btn btn-ghost btn-sm btn-square"
      onclick={() => sync.syncNow()}
      disabled={syncing}
      aria-label="Sync now"
      title="Sync now"
    >
      {#if syncing}
        <span class="loading loading-spinner loading-xs"></span>
      {:else}
        <Icon name="sync" size={16} />
      {/if}
    </button>
  {/if}
</div>

<style lang="scss">
  @use 'tokens' as *;

  .sync-status {
    border-top: 1px solid tint($neutral-content, 12%);

    .btn {
      color: tint($neutral-content, 70%);

      &:hover:not(:disabled) {
        background: tint($neutral-content, 10%);
        color: $neutral-content;
      }

      &:disabled {
        background: transparent;
      }
    }
  }

  .status:not([class*='status-']) {
    background: tint($neutral-content, 45%);
  }
</style>

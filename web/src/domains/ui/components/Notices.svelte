<script>
  import { ui } from '../ui.service.svelte.js';

  function undo(notice) {
    notice.undo();
    ui.dismiss(notice.id);
  }
</script>

<div class="toast toast-center toast-bottom z-50" aria-live="polite">
  {#each ui.notices as notice (notice.id)}
    <div role="status" class="notice alert py-2 pr-2 text-sm shadow-lg" class:alert-error={notice.tone === 'error'}>
      <span>{notice.message}</span>
      <div class="flex items-center">
        {#if notice.undo}
          <button type="button" class="btn btn-ghost btn-sm" onclick={() => undo(notice)}>Undo</button>
        {/if}
        <button type="button" class="btn btn-ghost btn-sm btn-square" aria-label="Dismiss" onclick={() => ui.dismiss(notice.id)}>
          ×
        </button>
      </div>
    </div>
  {/each}
</div>

<style lang="scss">
  @use 'tokens' as *;

  .notice {
    grid-auto-flow: column;
    justify-content: space-between;
    max-width: min(30rem, calc(100vw - 2rem));
    animation: rise $duration-fast $ease-out;

    // Info notices use the dark panel color so they stand out on the page.
    &:not(.alert-error) {
      border-color: $neutral;
      background: $neutral;
      color: $neutral-content;
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
</style>

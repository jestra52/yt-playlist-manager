<script>
    import Icon from '../../../shared/components/Icon.svelte';
    import { ui } from '../ui.service.svelte.js';

    const options = [
        { id: 'system', label: 'Match system', icon: 'monitor' },
        { id: 'light', label: 'Light', icon: 'sun' },
        { id: 'dark', label: 'Dark', icon: 'moon' },
    ];
</script>

<div class="theme flex items-center justify-between px-3 pt-3">
    <span class="text-xs opacity-70">Appearance</span>
    <div class="join" role="radiogroup" aria-label="Appearance">
        {#each options as option (option.id)}
            <button
                type="button"
                role="radio"
                aria-checked={ui.theme === option.id}
                aria-label={option.label}
                title={option.label}
                class="btn btn-xs btn-square join-item"
                class:on={ui.theme === option.id}
                onclick={() => ui.setTheme(option.id)}
            >
                <Icon name={option.icon} size={14} />
            </button>
        {/each}
    </div>
</div>

<style lang="scss">
    @use 'tokens' as *;

    .theme .btn {
        border-color: tint($neutral-content, 18%);
        background: transparent;
        color: tint($neutral-content, 65%);

        &:hover {
            color: $neutral-content;
        }

        &.on {
            background: tint($neutral-content, 16%);
            color: $neutral-content;
        }
    }
</style>

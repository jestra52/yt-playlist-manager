import { Icon } from '../../../../shared/components/Icon';

interface CreditFieldProps {
    id: string;
    label: string;
    value: string;
    autoFocus: boolean;
    onChange: (name: string) => void;
    onMoveUp: (() => void) | null;
    onMoveDown: (() => void) | null;
    onRemove: (() => void) | null;
}

const BUTTON = 'btn btn-ghost btn-square btn-xs';

export const CreditField = ({
    id,
    label,
    value,
    autoFocus,
    onChange,
    onMoveUp,
    onMoveDown,
    onRemove,
}: CreditFieldProps) => (
    <div className="flex items-center gap-1">
        <label className="sr-only" htmlFor={id}>
            {label}
        </label>
        <input
            id={id}
            className="input input-xs w-full max-w-xs text-sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            list="known-artists"
            maxLength={200}
            placeholder={label.startsWith('Featured') ? 'Featured artist' : 'Artist'}
            autoComplete="off"
            spellCheck={false}
            autoFocus={autoFocus}
        />
        {(onMoveUp || onMoveDown) && (
            <>
                <button
                    type="button"
                    className={BUTTON}
                    aria-label={`Move up: ${label}`}
                    title="Move up"
                    disabled={!onMoveUp}
                    onClick={onMoveUp ?? undefined}
                >
                    <Icon name="up" size={14} />
                </button>
                <button
                    type="button"
                    className={BUTTON}
                    aria-label={`Move down: ${label}`}
                    title="Move down"
                    disabled={!onMoveDown}
                    onClick={onMoveDown ?? undefined}
                >
                    <Icon name="down" size={14} />
                </button>
            </>
        )}
        {onRemove && (
            <button type="button" className={BUTTON} aria-label={`Remove: ${label}`} title="Remove" onClick={onRemove}>
                <Icon name="close" size={14} />
            </button>
        )}
    </div>
);

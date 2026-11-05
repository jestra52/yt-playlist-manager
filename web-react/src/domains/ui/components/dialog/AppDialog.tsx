import { type ReactNode, useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../../shared/components/Icon';
import { trackDialog } from './openDialogs';
import type { DialogControls } from './useDialog';

const LEAVE_MS = 300;

interface AppDialogProps extends Omit<DialogControls, 'onExited'> {
    title: string;
    onExited?: () => void;
    actions?: ReactNode;
    children: ReactNode;
}

export const AppDialog = ({ open, onClose, onExited, title, actions, children }: AppDialogProps) => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const [mounted, setMounted] = useState(open);
    if (open && !mounted) setMounted(true);

    const exited = useEffectEvent(() => {
        setMounted(false);
        onExited?.();
    });

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return undefined;
        if (open) {
            if (!dialog.open) dialog.showModal();
            return trackDialog(dialog);
        }
        dialog.close();
        const timer = setTimeout(exited, LEAVE_MS);
        return () => clearTimeout(timer);
    }, [open]);

    if (!mounted) return null;

    return createPortal(
        <dialog
            ref={dialogRef}
            className="modal modal-bottom sm:modal-middle"
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            onClose={(event) => {
                if (open && !event.currentTarget.open) onClose();
            }}
        >
            <div className="modal-box">
                <button
                    className="btn btn-sm btn-circle btn-ghost absolute top-3 right-3"
                    type="button"
                    aria-label="Close"
                    onClick={onClose}
                >
                    <Icon name="close" size={16} />
                </button>
                <h2 id={titleId} className="font-display mb-2 pr-10 text-2xl font-bold tracking-tight">
                    {title}
                </h2>
                <div className="min-w-0">{children}</div>
                {actions && <div className="modal-action">{actions}</div>}
            </div>
            <div className="modal-backdrop" aria-hidden="true">
                <button type="button" tabIndex={-1} onClick={onClose}>
                    Close
                </button>
            </div>
        </dialog>,
        document.body,
    );
};

import { useState } from 'react';

export interface DialogControls {
    open: boolean;
    onClose: () => void;
    onExited: () => void;
}

/** Keeps a dialog mounted until its closing animation ends, then drops it so it opens fresh next time. */
export const useDialog = () => {
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);

    const show = () => {
        setMounted(true);
        setOpen(true);
    };
    const controls: DialogControls = {
        open,
        onClose: () => setOpen(false),
        onExited: () => setMounted(false),
    };

    return { mounted, show, controls };
};

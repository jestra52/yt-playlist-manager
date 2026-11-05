import CloseIcon from '@mui/icons-material/Close';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import type { ReactNode } from 'react';
import styles from './AppDialog.module.scss';
import type { DialogControls } from './useDialog';

interface AppDialogProps extends Omit<DialogControls, 'onExited'> {
    title: string;
    onExited?: () => void;
    actions?: ReactNode;
    children: ReactNode;
}

export const AppDialog = ({ open, onClose, onExited, title, actions, children }: AppDialogProps) => (
    <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        transitionDuration={300}
        classes={{ container: styles.container, paper: open ? styles.paper : `${styles.paper} ${styles.leaving}` }}
        slotProps={{
            backdrop: { className: styles.backdrop },
            transition: { easing: 'ease-out', onExited },
        }}
    >
        <IconButton className={styles.close} size="small" aria-label="Close" onClick={onClose}>
            <CloseIcon fontSize="small" />
        </IconButton>
        <DialogTitle className={styles.title}>{title}</DialogTitle>
        <div className={styles.content}>{children}</div>
        {actions && <div className={styles.actions}>{actions}</div>}
    </Dialog>
);

import CloseIcon from '@mui/icons-material/Close';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import type { ReactNode } from 'react';
import styles from './AppDialog.module.scss';

interface AppDialogProps {
    title: string;
    onClose: () => void;
    actions: ReactNode;
    children: ReactNode;
}

export const AppDialog = ({ title, onClose, actions, children }: AppDialogProps) => (
    <Dialog open onClose={onClose} fullWidth classes={{ container: styles.container, paper: styles.paper }}>
        <IconButton className={styles.close} size="small" aria-label="Close" onClick={onClose}>
            <CloseIcon fontSize="small" />
        </IconButton>
        <DialogTitle className={styles.title}>{title}</DialogTitle>
        <div className={styles.content}>{children}</div>
        <div className={styles.actions}>{actions}</div>
    </Dialog>
);

import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import Button from '@mui/material/Button';
import { chainCodeFileText } from '@ytpm/core/sync/chain-code';
import { useAppDispatch } from '../../../../app/store';
import { downloadTextFile } from '../../../../shared/download';
import { notify } from '../../../ui/ui.slice';
import fields from '../settings/Field.module.scss';
import styles from './CodeActions.module.scss';
import { useQrCode } from './useQrCode';

export const CodeActions = ({ words, recoveryCodes }: { words: string[]; recoveryCodes: string[] }) => {
    const qr = useQrCode(words.join(' '));
    const dispatch = useAppDispatch();
    const text = () => chainCodeFileText({ words, recoveryCodes });
    const fileName = words.length ? 'sync-chain-code.txt' : 'sync-chain-recovery-codes.txt';

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text());
            dispatch(notify('Copied. Paste it somewhere safe, like a password manager.'));
        } catch {
            dispatch(notify("Couldn't copy; download the codes instead", { tone: 'error' }));
        }
    };

    const button = { variant: 'contained', color: 'inherit', size: 'small', className: fields.soft } as const;

    return (
        <div className={styles.row}>
            {qr && <img className={styles.qr} src={qr} alt="The code as a QR code" width={132} height={132} />}
            <div className={qr ? styles.column : styles.buttons}>
                <Button
                    {...button}
                    startIcon={<FileDownloadOutlined />}
                    onClick={() => downloadTextFile(fileName, text())}
                >
                    Download as .txt
                </Button>
                <Button {...button} onClick={copy}>
                    Copy
                </Button>
                <Button {...button} onClick={() => window.print()}>
                    Print
                </Button>
            </div>
        </div>
    );
};

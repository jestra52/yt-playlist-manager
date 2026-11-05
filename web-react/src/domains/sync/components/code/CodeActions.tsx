import { chainCodeFileText } from '@ytpm/core/sync/chain-code';
import { useAppDispatch } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { downloadTextFile } from '../../../../shared/download';
import { notify } from '../../../ui/ui.slice';
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

    return (
        <div className="mt-3 flex flex-wrap items-center gap-4">
            {qr && (
                <img
                    className="rounded-box flex-none bg-white p-1"
                    src={qr}
                    alt="The code as a QR code"
                    width={132}
                    height={132}
                />
            )}
            <div className={`flex flex-wrap gap-2 print:hidden ${qr ? 'flex-col' : ''}`}>
                <button className="btn btn-sm" type="button" onClick={() => downloadTextFile(fileName, text())}>
                    <Icon name="download" size={16} />
                    Download as .txt
                </button>
                <button className="btn btn-sm" type="button" onClick={copy}>
                    Copy
                </button>
                <button className="btn btn-sm" type="button" onClick={() => window.print()}>
                    Print
                </button>
            </div>
        </div>
    );
};

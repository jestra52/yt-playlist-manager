import Button from '@mui/material/Button';
import { isPairingCode, pairingCodeProblem } from '@ytpm/core/sync/pairing-code';
import { canScan } from '@ytpm/core/sync/qr-scan';
import { useAppSelector } from '../../../../app/store';
import { Field } from '../settings/Field';
import fields from '../settings/Field.module.scss';
import styles from './PairForm.module.scss';
import { WaitingForApproval } from './WaitingForApproval';

interface PairFormProps {
    deviceName: string;
    text: string;
    onText: (text: string) => void;
    onSubmit: () => void;
    onBack: () => void;
    onScan: () => void;
}

export const PairForm = ({ deviceName, text, onText, onSubmit, onBack, onScan }: PairFormProps) => {
    const busy = useAppSelector((state) => state.sync.busy);
    const joinRequest = useAppSelector((state) => state.sync.joinRequest);

    if (joinRequest?.status === 'requested') {
        return <WaitingForApproval deviceName={deviceName} expiresAt={joinRequest.expiresAt} />;
    }

    return (
        <>
            {joinRequest && (
                <p className={styles.refused} role="alert">
                    {joinRequest.status === 'denied'
                        ? 'The other device refused to let this one join.'
                        : 'The request expired before it was approved.'}{' '}
                    Ask for a new pairing code to try again.
                </p>
            )}
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    onSubmit();
                }}
            >
                <Field
                    label="Pairing code"
                    problem={pairingCodeProblem(text)}
                    hint="On a device that's already in the chain, open sync settings and choose Show a pairing code."
                >
                    <input
                        className={`${fields.input} ${fields.code} ${fields.wide}`}
                        value={text}
                        onChange={(e) => onText(e.target.value)}
                        placeholder="XXXX-XXXX"
                        autoComplete="one-time-code"
                        autoCapitalize="characters"
                        spellCheck={false}
                    />
                </Field>
                <div className={fields.buttons}>
                    <Button color="inherit" onClick={onBack}>
                        Back
                    </Button>
                    {canScan() && (
                        <Button
                            variant="contained"
                            color="inherit"
                            className={fields.soft}
                            disabled={busy}
                            onClick={onScan}
                        >
                            Scan
                        </Button>
                    )}
                    <Button type="submit" variant="contained" disabled={busy || !isPairingCode(text)}>
                        Ask to join
                    </Button>
                </div>
            </form>
        </>
    );
};

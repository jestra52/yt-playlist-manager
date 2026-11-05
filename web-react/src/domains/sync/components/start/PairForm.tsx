import { isPairingCode, pairingCodeProblem } from '@ytpm/core/sync/pairing-code';
import { canScan } from '@ytpm/core/sync/qr-scan';
import { useAppSelector } from '../../../../app/store';
import { Field } from '../settings/Field';
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
                <p className="text-error mt-0 mb-2 text-sm" role="alert">
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
                        className="input w-full font-mono text-lg tracking-widest uppercase"
                        value={text}
                        onChange={(e) => onText(e.target.value)}
                        placeholder="XXXX-XXXX"
                        autoComplete="one-time-code"
                        autoCapitalize="characters"
                        spellCheck={false}
                    />
                </Field>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button className="btn btn-ghost" type="button" onClick={onBack}>
                        Back
                    </button>
                    {canScan() && (
                        <button className="btn" type="button" disabled={busy} onClick={onScan}>
                            Scan
                        </button>
                    )}
                    <button className="btn btn-primary" type="submit" disabled={busy || !isPairingCode(text)}>
                        Ask to join
                    </button>
                </div>
            </form>
        </>
    );
};

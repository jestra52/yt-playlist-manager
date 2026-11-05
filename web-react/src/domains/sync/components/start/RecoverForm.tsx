import { RECOVERY_CODE_LENGTH, isRecoveryCode, recoveryCodeProblem } from '@ytpm/core/sync/recovery-code';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { recoverChain } from '../../chain.thunks';
import { Field } from '../settings/Field';

export const RecoverForm = ({ deviceName, onBack }: { deviceName: string; onBack: () => void }) => {
    const [text, setText] = useState('');
    const busy = useAppSelector((state) => state.sync.busy);
    const dispatch = useAppDispatch();

    return (
        <form
            onSubmit={async (event) => {
                event.preventDefault();
                if (await dispatch(recoverChain(text, deviceName))) setText('');
            }}
        >
            <Field
                label="Recovery code"
                problem={recoveryCodeProblem(text)}
                hint={`One of the ${RECOVERY_CODE_LENGTH}-character codes you saved with the chain code.`}
            >
                <input
                    className="input w-full font-mono uppercase"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                />
            </Field>
            <p className="text-warning mt-2 mb-0 text-sm">
                The chain gets a new code and new recovery codes, every other device is removed, and this device joins.
                Your playlists stay. The code you use stops working.
            </p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button className="btn btn-ghost" type="button" onClick={onBack}>
                    Back
                </button>
                <button className="btn" type="submit" disabled={busy || !isRecoveryCode(text)}>
                    {busy && <span className="loading loading-spinner loading-xs" />}
                    Recover
                </button>
            </div>
        </form>
    );
};

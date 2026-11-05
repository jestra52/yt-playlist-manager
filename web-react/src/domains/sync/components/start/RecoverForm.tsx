import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { RECOVERY_CODE_LENGTH, isRecoveryCode, recoveryCodeProblem } from '@ytpm/core/sync/recovery-code';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { recoverChain } from '../../chain.thunks';
import { Field } from '../settings/Field';
import fields from '../settings/Field.module.scss';
import styles from './RecoverForm.module.scss';

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
                    className={`${fields.input} ${fields.code}`}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                />
            </Field>
            <p className={styles.warning}>
                The chain gets a new code and new recovery codes, every other device is removed, and this device joins.
                Your playlists stay. The code you use stops working.
            </p>
            <div className={fields.buttons}>
                <Button color="inherit" onClick={onBack}>
                    Back
                </Button>
                <Button
                    type="submit"
                    variant="contained"
                    disabled={busy || !isRecoveryCode(text)}
                    startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
                >
                    Recover
                </Button>
            </div>
        </form>
    );
};

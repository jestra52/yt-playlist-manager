import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { ChainCodeError, WORD_COUNT, splitWords, wordsToSecret } from '@ytpm/core/sync/chain-code';
import { canScan } from '@ytpm/core/sync/qr-scan';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { joinChain } from '../../chain.thunks';
import { Field } from '../settings/Field';
import fields from '../settings/Field.module.scss';

const problemWith = (text: string): string => {
    if (splitWords(text).length < WORD_COUNT) return '';
    try {
        wordsToSecret(text);
        return '';
    } catch (err) {
        return err instanceof ChainCodeError ? err.message : "That code can't be read.";
    }
};

interface JoinFormProps {
    deviceName: string;
    text: string;
    onText: (text: string) => void;
    onBack: () => void;
    onScan: () => void;
}

export const JoinForm = ({ deviceName, text, onText, onBack, onScan }: JoinFormProps) => {
    const busy = useAppSelector((state) => state.sync.busy);
    const dispatch = useAppDispatch();
    const typed = splitWords(text).length;
    const problem = problemWith(text);

    return (
        <form
            onSubmit={async (event) => {
                event.preventDefault();
                if (await dispatch(joinChain(text, deviceName))) onText('');
            }}
        >
            <Field label="Sync chain code" problem={problem} hint={`${typed} of ${WORD_COUNT} words`}>
                <textarea
                    className={`${fields.input} ${fields.words}`}
                    rows={4}
                    value={text}
                    onChange={(e) => onText(e.target.value)}
                    placeholder="The 24 words, or paste the downloaded code file"
                    autoComplete="off"
                    autoCapitalize="off"
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
                <Button
                    type="submit"
                    variant="contained"
                    disabled={busy || typed !== WORD_COUNT || Boolean(problem)}
                    startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
                >
                    Join
                </Button>
            </div>
        </form>
    );
};

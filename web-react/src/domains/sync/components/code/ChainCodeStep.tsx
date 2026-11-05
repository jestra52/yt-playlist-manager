import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { confirmationPositions } from '@ytpm/core/sync/chain-code';
import { useState } from 'react';
import type { NewCode } from '../../sync.slice';
import styles from './ChainCodeStep.module.scss';
import { CodeActions } from './CodeActions';

const INTROS: Record<NewCode['reason'], string> = {
    created: 'Your sync chain is ready. This is its code: you need it to add another device.',
    claimed: 'Your synced playlists are now a sync chain. This is its code: you need it to add another device.',
    replaced:
        'The chain has a new code and new recovery codes. The old ones no longer work, and your other devices were removed.',
    recovered:
        "You're back in your sync chain, with your playlists. It has a new code and new recovery codes: the old ones no longer work, and every other device was removed.",
    'recovery-codes': 'These are your new recovery codes. The old ones no longer work.',
};

export const ChainCodeStep = ({ code, onDone }: { code: NewCode; onDone: () => void }) => {
    const words = code.words ?? [];
    const recoveryCodes = code.recoveryCodes ?? [];
    const [positions] = useState(() => (words.length ? confirmationPositions(3) : []));
    const [answers, setAnswers] = useState(['', '', '']);
    const [codesSaved, setCodesSaved] = useState(false);
    const confirmed = words.length
        ? positions.every((position, i) => answers[i]?.trim().toLowerCase() === words[position - 1])
        : codesSaved;

    return (
        <section className={styles.step} aria-labelledby="chain-code-title">
            <h3 id="chain-code-title" className={styles.title}>
                {words.length ? 'Save your sync chain code' : 'Save your recovery codes'}
            </h3>
            <p className={styles.muted}>{INTROS[code.reason]}</p>

            {words.length > 0 && (
                <>
                    <p className={styles.warning}>
                        Anyone with these words can see and change your playlists. Keep them somewhere safe and private,
                        like a password manager. They won't be shown again.
                    </p>
                    <ol className={styles.words}>
                        {words.map((word, position) => (
                            // Words can repeat, and the list never changes.
                            // eslint-disable-next-line @eslint-react/no-array-index-key
                            <li key={position}>
                                <span className={styles.number}>{position + 1}.</span> {word}
                            </li>
                        ))}
                    </ol>
                </>
            )}

            {recoveryCodes.length > 0 && (
                <>
                    <h4 className={styles.subtitle}>Recovery codes</h4>
                    <p className={styles.muted}>
                        If every device is gone and the code is lost, any one of these gets the chain back. Each works
                        once. Keep them apart from the code, for example printed at home.
                    </p>
                    <ul className={styles.codes}>
                        {recoveryCodes.map((recoveryCode) => (
                            <li key={recoveryCode}>{recoveryCode}</li>
                        ))}
                    </ul>
                </>
            )}

            <CodeActions words={words} recoveryCodes={recoveryCodes} />

            {words.length > 0 ? (
                <fieldset className={`${styles.check} ${styles.noPrint}`}>
                    <legend className={styles.legend}>Check that you saved it</legend>
                    {positions.map((position, i) => (
                        <label key={position} className={styles.answer}>
                            <span>Word {position}</span>
                            <input
                                value={answers[i]}
                                onChange={(e) => setAnswers(answers.map((a, n) => (n === i ? e.target.value : a)))}
                                autoComplete="off"
                                autoCapitalize="off"
                                spellCheck={false}
                            />
                        </label>
                    ))}
                </fieldset>
            ) : (
                <FormControlLabel
                    className={styles.noPrint}
                    label="I've saved the recovery codes"
                    control={
                        <Checkbox size="small" checked={codesSaved} onChange={(e) => setCodesSaved(e.target.checked)} />
                    }
                />
            )}

            <div className={`${styles.done} ${styles.noPrint}`}>
                <Button variant="contained" disabled={!confirmed} onClick={onDone}>
                    {words.length ? "I've saved the code" : 'Done'}
                </Button>
            </div>
        </section>
    );
};

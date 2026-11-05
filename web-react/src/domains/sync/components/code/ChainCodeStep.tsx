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
        <section className={`text-sm ${styles.step}`} aria-labelledby="chain-code-title">
            <h3 id="chain-code-title" className="mt-0 mb-1 text-base font-semibold">
                {words.length ? 'Save your sync chain code' : 'Save your recovery codes'}
            </h3>
            <p className="text-base-content/65 m-0">{INTROS[code.reason]}</p>

            {words.length > 0 && (
                <>
                    <p className="mt-2 mb-0 font-medium">
                        Anyone with these words can see and change your playlists. Keep them somewhere safe and private,
                        like a password manager. They won't be shown again.
                    </p>
                    <ol className="rounded-box bg-base-200 mt-3 mb-0 grid list-none grid-cols-2 gap-x-3 gap-y-1 p-3 font-mono whitespace-nowrap sm:grid-cols-4">
                        {words.map((word, position) => (
                            // Words can repeat, and the list never changes.
                            // eslint-disable-next-line @eslint-react/no-array-index-key
                            <li key={position}>
                                <span className="text-base-content/50">{position + 1}.</span> {word}
                            </li>
                        ))}
                    </ol>
                </>
            )}

            {recoveryCodes.length > 0 && (
                <>
                    <h4 className="mt-4 mb-0 text-sm font-semibold">Recovery codes</h4>
                    <p className="text-base-content/65 m-0">
                        If every device is gone and the code is lost, any one of these gets the chain back. Each works
                        once. Keep them apart from the code, for example printed at home.
                    </p>
                    <ul className="rounded-box bg-base-200 mt-2 mb-0 grid list-none grid-cols-1 gap-x-3 gap-y-1 p-3 font-mono whitespace-nowrap sm:grid-cols-2">
                        {recoveryCodes.map((recoveryCode) => (
                            <li key={recoveryCode}>{recoveryCode}</li>
                        ))}
                    </ul>
                </>
            )}

            <CodeActions words={words} recoveryCodes={recoveryCodes} />

            {words.length > 0 ? (
                <fieldset className={`fieldset mt-4 ${styles.noPrint}`}>
                    <legend className="fieldset-legend">Check that you saved it</legend>
                    <div className="flex flex-wrap gap-2">
                        {positions.map((position, i) => (
                            <label key={position} className="input input-sm w-36">
                                <span className="label">Word {position}</span>
                                <input
                                    value={answers[i]}
                                    onChange={(e) => setAnswers(answers.map((a, n) => (n === i ? e.target.value : a)))}
                                    autoComplete="off"
                                    autoCapitalize="off"
                                    spellCheck={false}
                                />
                            </label>
                        ))}
                    </div>
                </fieldset>
            ) : (
                <label className={`label text-base-content mt-4 cursor-pointer gap-3 text-sm ${styles.noPrint}`}>
                    <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={codesSaved}
                        onChange={(e) => setCodesSaved(e.target.checked)}
                    />
                    I've saved the recovery codes
                </label>
            )}

            <div className={`mt-4 flex justify-end ${styles.noPrint}`}>
                <button className="btn btn-primary" type="button" disabled={!confirmed} onClick={onDone}>
                    {words.length ? "I've saved the code" : 'Done'}
                </button>
            </div>
        </section>
    );
};

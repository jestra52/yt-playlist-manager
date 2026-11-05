import { defaultDeviceName } from '@ytpm/core/sync/chain-code';
import type { ScannedCode } from '@ytpm/core/sync/qr-scan';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { joinWithPairingCode } from '../../pairing.thunks';
import { Field } from '../settings/Field';
import { ChooseWay } from './ChooseWay';
import { JoinForm } from './JoinForm';
import { LegacyClaim } from './LegacyClaim';
import { PairForm } from './PairForm';
import { QrScanner } from './QrScanner';
import { RecoverForm } from './RecoverForm';

export type StartMode = 'choose' | 'pair' | 'join' | 'recover';

export const StartScreen = () => {
    const waiting = useAppSelector((state) => Boolean(state.sync.joinRequest));
    const legacy = useAppSelector((state) => Boolean(state.sync.settings.legacyToken));
    const dispatch = useAppDispatch();
    const [deviceName, setDeviceName] = useState(() => defaultDeviceName());
    // A request waiting for approval keeps going while the dialog is closed.
    const [mode, setMode] = useState<StartMode>(waiting ? 'pair' : 'choose');
    const [scanning, setScanning] = useState(false);
    const [pairText, setPairText] = useState('');
    const [codeText, setCodeText] = useState('');

    const pairWith = async (text: string) => {
        if (await dispatch(joinWithPairingCode(text, deviceName))) setPairText('');
    };

    // A scanned pairing code is sent at once; scanned words fill in the chain code to check before joining.
    const scanned = (code: ScannedCode) => {
        setScanning(false);
        if (code.kind === 'pairing') {
            setPairText(code.code);
            setMode('pair');
            pairWith(code.code);
        } else {
            setCodeText(code.text);
            setMode('join');
        }
    };

    const back = () => setMode('choose');
    const scan = () => setScanning(true);

    return (
        <>
            <p className="text-base-content/65 mt-0 mb-4 text-sm">
                Your playlists are saved in a SQLite database in this browser. A <strong>sync chain</strong> keeps your
                devices in step: create one here, then add your other devices with a pairing code from this one, or with
                the chain's 24-word code. No account or password needed.
            </p>
            <div className="mb-3">
                <Field label="This device's name">
                    <input
                        className="input w-full"
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)}
                        maxLength={100}
                        autoComplete="off"
                    />
                </Field>
            </div>
            {legacy && <LegacyClaim deviceName={deviceName} />}
            {scanning && <QrScanner onScan={scanned} onCancel={() => setScanning(false)} />}
            {!scanning && mode === 'choose' && <ChooseWay deviceName={deviceName} onMode={setMode} onScan={scan} />}
            {!scanning && mode === 'pair' && (
                <PairForm
                    deviceName={deviceName}
                    text={pairText}
                    onText={setPairText}
                    onSubmit={() => pairWith(pairText)}
                    onBack={back}
                    onScan={scan}
                />
            )}
            {!scanning && mode === 'join' && (
                <JoinForm deviceName={deviceName} text={codeText} onText={setCodeText} onBack={back} onScan={scan} />
            )}
            {!scanning && mode === 'recover' && <RecoverForm deviceName={deviceName} onBack={back} />}
        </>
    );
};

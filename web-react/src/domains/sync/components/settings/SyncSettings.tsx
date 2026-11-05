import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { codeSaved, loadEvents } from '../../chain.thunks';
import { selectConfigured } from '../../sync.selectors';
import { loadChain } from '../../sync.thunks';
import { ChainCodeStep } from '../code/ChainCodeStep';
import { ConnectionPanel } from '../connection/ConnectionPanel';
import { ExportDatabase } from '../connection/ExportDatabase';
import { StartScreen } from '../start/StartScreen';
import styles from './SyncSettings.module.scss';

export const SyncSettings = () => {
    const newCode = useAppSelector((state) => state.sync.newCode);
    const configured = useAppSelector(selectConfigured);
    const dispatch = useAppDispatch();

    useEffect(() => {
        dispatch(loadChain());
        dispatch(loadEvents());
    }, [dispatch]);

    if (newCode) {
        return (
            <ChainCodeStep
                key={newCode.words?.join(' ') ?? newCode.recoveryCodes?.join(' ')}
                code={newCode}
                onDone={() => dispatch(codeSaved())}
            />
        );
    }

    return (
        <>
            {configured ? (
                <p className={styles.intro}>
                    This device is in a sync chain: your playlists sync with the other devices in it.
                </p>
            ) : (
                <StartScreen />
            )}
            <ConnectionPanel />
            <ExportDatabase />
        </>
    );
};

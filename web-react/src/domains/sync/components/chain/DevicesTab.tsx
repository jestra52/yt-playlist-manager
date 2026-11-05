import { AddDevice } from './AddDevice';
import { ChainDevices } from './ChainDevices';
import { ChainReminders } from './ChainReminders';

export const DevicesTab = ({ onReplaceCode }: { onReplaceCode: () => void }) => (
    <>
        <ChainReminders onReplaceCode={onReplaceCode} />
        <ChainDevices />
        <AddDevice />
    </>
);

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { removeDevice } from '../../chain.thunks';

const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const when = (ms: number) => (ms ? formatter.format(new Date(ms)) : '—');

export const ChainDevices = () => {
    const chain = useAppSelector((state) => state.sync.chain);
    const busy = useAppSelector((state) => state.sync.busy);
    const dispatch = useAppDispatch();
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    useEffect(() => {
        if (!confirmingId) return undefined;
        const timer = setTimeout(() => setConfirmingId(null), 4000);
        return () => clearTimeout(timer);
    }, [confirmingId]);

    const remove = (id: string) => {
        if (confirmingId !== id) {
            setConfirmingId(id);
            return;
        }
        setConfirmingId(null);
        dispatch(removeDevice(id));
    };

    return (
        <section aria-labelledby="chain-devices-title">
            <h3 id="chain-devices-title" className="mt-0 mb-2 text-base font-semibold">
                Devices in this sync chain
            </h3>
            {!chain ? (
                <p className="text-base-content/65 m-0 flex items-center gap-2">
                    <span className="loading loading-spinner loading-xs" /> Loading devices…
                </p>
            ) : (
                <>
                    <ul className="rounded-box border-base-300 divide-base-300 m-0 list-none divide-y border p-0">
                        {chain.devices.map((device) => {
                            const current = device.id === chain.deviceId;
                            const confirming = confirmingId === device.id;
                            return (
                                <li key={device.id} className="flex items-center gap-3 px-3 py-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="m-0 truncate font-medium">
                                            {device.name}
                                            {current && (
                                                <span className="badge badge-sm badge-soft badge-primary ml-2">
                                                    This device
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-base-content/65 m-0 text-xs">
                                            Joined {when(device.createdAt)} · last seen {when(device.lastSeenAt)}
                                        </p>
                                    </div>
                                    {!current && (
                                        <button
                                            className={`btn btn-sm ${confirming ? 'btn-error' : 'btn-ghost'}`}
                                            type="button"
                                            disabled={busy}
                                            aria-label={
                                                confirming ? `Confirm removing ${device.name}` : `Remove ${device.name}`
                                            }
                                            onClick={() => remove(device.id)}
                                        >
                                            {confirming ? 'Remove it' : 'Remove'}
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    <p className="text-base-content/65 mt-1 mb-0 text-xs">
                        A removed device stops syncing at once and keeps its playlists. It can join again with the chain
                        code.
                    </p>
                </>
            )}
        </section>
    );
};

import { describeEvent } from '@ytpm/core/sync/chain-events';
import { useAppSelector } from '../../../../app/store';

const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const ActivityTab = () => {
    const events = useAppSelector((state) => state.sync.events);

    if (!events) {
        return (
            <p className="text-base-content/65 m-0 flex items-center gap-2">
                <span className="loading loading-spinner loading-xs" /> Loading activity…
            </p>
        );
    }
    if (!events.length) return <p className="text-base-content/65 m-0 flex items-center gap-2">Nothing yet.</p>;

    return (
        <ul className="divide-base-300 m-0 list-none divide-y p-0">
            {events.map((event) => (
                <li
                    key={`${event.at}:${event.kind}:${event.deviceName}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5"
                >
                    <span>{describeEvent(event)}</span>
                    <time className="text-base-content/65 text-xs" dateTime={new Date(event.at).toISOString()}>
                        {formatter.format(new Date(event.at))}
                    </time>
                </li>
            ))}
        </ul>
    );
};

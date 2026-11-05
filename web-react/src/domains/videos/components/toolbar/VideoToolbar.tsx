import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { selectFilter, selectMissingCount, selectQuery } from '../../videos.selectors';
import { filterSet, querySet, type VideoFilter } from '../../videos.slice';

export const VideoToolbar = ({ playlistId }: { playlistId: string }) => {
    const filter = useAppSelector(selectFilter);
    const query = useAppSelector(selectQuery);
    const missing = useAppSelector((state) => selectMissingCount(state, playlistId));
    const dispatch = useAppDispatch();

    const filters: { id: VideoFilter; label: string }[] = [
        { id: 'all', label: 'All' },
        { id: 'unwatched', label: 'To watch' },
        { id: 'watched', label: 'Watched' },
        ...(missing > 0 || filter === 'missing' ? [{ id: 'missing' as const, label: `Missing (${missing})` }] : []),
    ];

    return (
        <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" className="tabs tabs-box tabs-sm bg-base-300/60" aria-label="Show">
                {filters.map(({ id, label }) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={filter === id}
                        className={`tab font-semibold ${filter === id ? 'tab-active' : ''}`}
                        onClick={() => dispatch(filterSet(id))}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <label className="input input-sm w-full sm:w-72">
                <Icon name="search" size={16} />
                <span className="sr-only">Search this playlist</span>
                <input
                    type="search"
                    className="grow"
                    value={query}
                    onChange={(e) => dispatch(querySet(e.target.value))}
                    placeholder="Search titles, artists, channels, notes"
                />
            </label>
        </div>
    );
};

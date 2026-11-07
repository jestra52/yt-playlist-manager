import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { selectFilter, selectQuery } from '../../videos.selectors';
import { filterSet, querySet, type VideoFilter } from '../../videos.slice';

const MESSAGES: Record<VideoFilter, string> = {
    all: 'Nothing here.',
    missing: 'Every item has its YouTube link.',
};

export const NoResults = () => {
    const filter = useAppSelector(selectFilter);
    const query = useAppSelector(selectQuery);
    const dispatch = useAppDispatch();
    const searching = Boolean(query.trim());

    return (
        <div className="rounded-box border-base-300 border border-dashed px-6 py-10">
            <p className="font-display mt-0 mb-4 text-2xl font-bold tracking-tight">
                {searching ? `Nothing matches "${query.trim()}".` : MESSAGES[filter]}
            </p>
            <button
                className="btn btn-sm"
                type="button"
                onClick={() => dispatch(searching ? querySet('') : filterSet('all'))}
            >
                {searching ? 'Clear search' : 'Show all videos'}
            </button>
        </div>
    );
};

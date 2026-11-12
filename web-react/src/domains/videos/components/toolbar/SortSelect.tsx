import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { selectSort } from '../../videos.selectors';
import { sortSet, type VideoSort } from '../../videos.slice';

const SORTS: { id: VideoSort; label: string }[] = [
    { id: 'default', label: 'Default' },
    { id: 'artist', label: 'Artist' },
    { id: 'title', label: 'Title' },
    { id: 'missing', label: 'Missing' },
];

export const SortSelect = () => {
    const sort = useAppSelector(selectSort);
    const dispatch = useAppDispatch();

    return (
        <label className="select select-sm w-auto">
            <span className="label">Sort</span>
            <select value={sort} onChange={(e) => dispatch(sortSet(e.target.value as VideoSort))}>
                {SORTS.map(({ id, label }) => (
                    <option key={id} value={id}>
                        {label}
                    </option>
                ))}
            </select>
        </label>
    );
};

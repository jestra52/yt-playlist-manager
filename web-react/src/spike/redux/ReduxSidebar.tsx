import { countRender } from '../renderCounts';
import { selectCounts, useSpikeSelector } from './videosStore';

export const ReduxSidebar = () => {
    countRender('sidebar');
    const counts = useSpikeSelector(selectCounts);
    return (
        <ul>
            {counts.map((p) => (
                <li key={p.id}>
                    {p.name} {p.left}/{p.total}
                </li>
            ))}
        </ul>
    );
};

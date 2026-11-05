import { useAppDispatch } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { toggleSidebar } from '../../ui.slice';

export const ShowPlaylistsButton = ({ className = '' }: { className?: string }) => {
    const dispatch = useAppDispatch();

    return (
        <button
            type="button"
            className={`btn btn-ghost btn-square -ml-2 md:hidden ${className}`}
            aria-label="Show playlists"
            onClick={() => dispatch(toggleSidebar(true))}
        >
            <Icon name="menu" />
        </button>
    );
};

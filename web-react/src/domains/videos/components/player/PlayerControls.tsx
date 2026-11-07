import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { selectNextVideo, selectPreviousVideo, selectShuffleOn } from '../../videos.selectors';
import { playerClosed } from '../../videos.slice';
import { playNext, playPrevious, toggleShuffle } from '../../videos.thunks';

// Labels fit next to the icons except on the narrowest phones.
const LABEL = 'max-[22.5rem]:hidden';
const BUTTON = 'btn btn-sm max-[22.5rem]:btn-square';

export const PlayerControls = () => {
    const hasNext = useAppSelector(selectNextVideo) !== null;
    const hasPrevious = useAppSelector(selectPreviousVideo) !== null;
    const shuffleOn = useAppSelector(selectShuffleOn);
    const dispatch = useAppDispatch();

    return (
        <div className="flex items-center gap-2">
            <button
                className={`${BUTTON} ${shuffleOn ? 'btn-secondary' : 'btn-ghost text-neutral-content'}`}
                type="button"
                aria-label="Shuffle"
                aria-pressed={shuffleOn}
                onClick={() => dispatch(toggleShuffle())}
            >
                <Icon name="shuffle" size={15} /> <span className={LABEL}>Shuffle</span>
            </button>
            <button
                className={`${BUTTON} btn-ghost text-neutral-content`}
                type="button"
                aria-label="Previous"
                disabled={!hasPrevious}
                onClick={() => dispatch(playPrevious())}
            >
                <Icon name="previous" size={15} /> <span className={LABEL}>Previous</span>
            </button>
            <button
                className={`${BUTTON} btn-primary`}
                type="button"
                aria-label="Next"
                disabled={!hasNext}
                onClick={() => dispatch(playNext())}
            >
                <Icon name="next" size={15} /> <span className={LABEL}>Next</span>
            </button>
            <button
                className="btn btn-ghost btn-sm btn-square text-neutral-content ml-auto"
                type="button"
                aria-label="Close player"
                onClick={() => dispatch(playerClosed())}
            >
                <Icon name="close" />
            </button>
        </div>
    );
};

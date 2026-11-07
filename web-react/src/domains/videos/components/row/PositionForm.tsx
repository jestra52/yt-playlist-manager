import type { Video } from '@ytpm/core/videos/videos.repository';
import { useEffect, useRef, useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { moveToPosition } from '../../videos.thunks';

interface PositionFormProps {
    video: Video;
    title: string;
    index: number;
    total: number;
    onMoved: () => void;
    onClose: () => void;
}

export const PositionForm = ({ video, title, index, total, onMoved, onClose }: PositionFormProps) => {
    const [position, setPosition] = useState(String(index + 1));
    const inputRef = useRef<HTMLInputElement>(null);
    const dispatch = useAppDispatch();
    const move = (to: string) => {
        if (dispatch(moveToPosition(video.id, to))) onMoved();
    };

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    return (
        <form
            className="mt-2 flex w-full max-w-xl flex-wrap items-center gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                move(position);
            }}
            onKeyDown={(event) => {
                if (event.key === 'Escape') onClose();
            }}
        >
            <label className="sr-only" htmlFor={`position-${video.id}`}>
                Position for {title}
            </label>
            <input
                ref={inputRef}
                id={`position-${video.id}`}
                className="input input-sm w-20"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                autoComplete="off"
                inputMode="numeric"
            />
            <span className="text-base-content/65 text-sm tabular-nums">of {total}</span>
            <button className="btn btn-sm btn-primary" type="submit">
                Move
            </button>
            <button className="btn btn-sm" type="button" disabled={index === 0} onClick={() => move('1')}>
                Top
            </button>
            <button
                className="btn btn-sm"
                type="button"
                disabled={index === total - 1}
                onClick={() => move(String(total))}
            >
                Bottom
            </button>
            <button className="btn btn-sm btn-ghost" type="button" onClick={onClose}>
                Cancel
            </button>
        </form>
    );
};

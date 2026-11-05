import { useId } from 'react';

interface LinkChoiceProps {
    wholePlaylist: boolean;
    onChange: (wholePlaylist: boolean) => void;
    videoLabel: string;
    playlistLabel: string;
    disabled?: boolean;
    size?: 'xs' | 'sm';
}

export const LinkChoice = ({
    wholePlaylist,
    onChange,
    videoLabel,
    playlistLabel,
    disabled,
    size = 'sm',
}: LinkChoiceProps) => {
    const groupId = useId();
    const radio = size === 'xs' ? 'radio radio-xs' : 'radio radio-sm';

    return (
        <fieldset
            className="m-0 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-0 p-0 text-sm"
            disabled={disabled}
        >
            <legend className="sr-only">This link is from a playlist</legend>
            <span className="opacity-70">This link is from a playlist:</span>
            <label className="flex cursor-pointer items-center gap-1.5">
                <input
                    type="radio"
                    className={radio}
                    name={groupId}
                    checked={!wholePlaylist}
                    onChange={() => onChange(false)}
                />
                {videoLabel}
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
                <input
                    type="radio"
                    className={radio}
                    name={groupId}
                    checked={wholePlaylist}
                    onChange={() => onChange(true)}
                />
                {playlistLabel}
            </label>
        </fieldset>
    );
};

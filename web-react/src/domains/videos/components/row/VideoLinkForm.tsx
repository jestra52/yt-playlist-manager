import type { Video } from '@ytpm/core/videos/videos.repository';
import { watchUrl } from '@ytpm/core/videos/youtube';
import { useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { changeVideoLink, completeVideo } from '../../videos.thunks';

interface VideoLinkFormProps {
    video: Video;
    title: string;
    /** Set when changing the link of a video that has one. */
    onClose?: () => void;
}

const placeholderFor = (video: Video) => {
    if (!video.missing) return 'Paste a YouTube link';
    if (video.unavailable) return 'Deleted on YouTube: paste another link to replace it';
    return 'Paste the YouTube link to complete it';
};

export const VideoLinkForm = ({ video, title, onClose }: VideoLinkFormProps) => {
    const [link, setLink] = useState(() => (onClose ? watchUrl(video.youtubeId) : ''));
    const [saving, setSaving] = useState(false);
    const dispatch = useAppDispatch();

    return (
        <form
            className={`mt-2 w-full max-w-xl ${onClose ? 'flex flex-wrap gap-2' : 'join'}`}
            onSubmit={async (event) => {
                event.preventDefault();
                if (!link.trim() || saving) return;
                setSaving(true);
                try {
                    const save = onClose ? changeVideoLink : completeVideo;
                    if (await dispatch(save(video.id, link))) {
                        setLink('');
                        onClose?.();
                    }
                } finally {
                    setSaving(false);
                }
            }}
        >
            <label className="sr-only" htmlFor={`link-${video.id}`}>
                YouTube link for {title}
            </label>
            <input
                id={`link-${video.id}`}
                className={`input input-sm min-w-0 flex-1 ${onClose ? 'basis-40' : 'join-item'}`}
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') onClose?.();
                }}
                placeholder={placeholderFor(video)}
                autoComplete="off"
                autoFocus={Boolean(onClose)}
                spellCheck={false}
                inputMode="url"
                disabled={saving}
            />
            <button
                className={`btn btn-sm btn-primary ${onClose ? '' : 'join-item'}`}
                type="submit"
                disabled={!link.trim() || saving}
            >
                {saving && <span className="loading loading-spinner loading-xs" />}
                Save
            </button>
            {onClose && (
                <button className="btn btn-sm" type="button" disabled={saving} onClick={onClose}>
                    Cancel
                </button>
            )}
        </form>
    );
};

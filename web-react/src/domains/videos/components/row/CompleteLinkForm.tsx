import type { Video } from '@ytpm/core/videos/videos.repository';
import { useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { completeVideo } from '../../videos.thunks';

export const CompleteLinkForm = ({ video, title }: { video: Video; title: string }) => {
    const [link, setLink] = useState('');
    const [saving, setSaving] = useState(false);
    const dispatch = useAppDispatch();

    return (
        <form
            className="join mt-2 w-full max-w-xl"
            onSubmit={async (event) => {
                event.preventDefault();
                if (!link.trim() || saving) return;
                setSaving(true);
                try {
                    if (await dispatch(completeVideo(video.id, link))) setLink('');
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
                className="input input-sm join-item min-w-0 flex-1"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder={
                    video.unavailable
                        ? 'Deleted on YouTube: paste another link to replace it'
                        : 'Paste the YouTube link to complete it'
                }
                autoComplete="off"
                spellCheck={false}
                inputMode="url"
                disabled={saving}
            />
            <button className="btn btn-sm btn-primary join-item" type="submit" disabled={!link.trim() || saving}>
                {saving && <span className="loading loading-spinner loading-xs" />}
                Save
            </button>
        </form>
    );
};

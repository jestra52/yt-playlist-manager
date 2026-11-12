import { cleanCredits, MAX_CREDITS, type ArtistCredit, type ArtistRole } from '@ytpm/core/videos/artist-credits';
import type { Video } from '@ytpm/core/videos/videos.repository';
import { useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { saveArtists } from '../../videos.thunks';
import { CreditField } from './CreditField';

interface Draft extends ArtistCredit {
    key: number;
}

const sameCredits = (a: readonly ArtistCredit[], b: readonly ArtistCredit[]) =>
    a.length === b.length && a.every((c, i) => c.name === b[i]?.name && c.role === b[i]?.role);

export const ArtistEditor = ({ video, title, onClose }: { video: Video; title: string; onClose: () => void }) => {
    const dispatch = useAppDispatch();
    const [drafts, setDrafts] = useState<Draft[]>(() =>
        (video.artists.length ? video.artists : [{ name: '', role: 'main' as const }]).map((credit, key) => ({
            ...credit,
            key,
        })),
    );
    const withKey = (credit: ArtistCredit): Draft => ({
        ...credit,
        key: Math.max(-1, ...drafts.map((d) => d.key)) + 1,
    });
    const [focusKey, setFocusKey] = useState(drafts[0]?.key);

    const save = () => {
        onClose();
        const credits = drafts.map(({ name, role }) => ({ name, role }));
        if (!sameCredits(cleanCredits(credits), video.artists)) dispatch(saveArtists(video.id, credits));
    };

    const add = (role: ArtistRole) => {
        const draft = withKey({ name: '', role });
        const at = role === 'main' ? drafts.filter((d) => d.role === 'main').length : drafts.length;
        setDrafts([...drafts.slice(0, at), draft, ...drafts.slice(at)]);
        setFocusKey(draft.key);
    };

    const change = (key: number, name: string) => setDrafts(drafts.map((d) => (d.key === key ? { ...d, name } : d)));

    const move = (from: number, to: number) => {
        const next = [...drafts];
        [next[from], next[to]] = [next[to]!, next[from]!];
        setDrafts(next);
    };

    const remove = (key: number) => {
        const next = drafts.filter((d) => d.key !== key);
        // Featured artists need a main one: the first of them takes its place.
        if (next.length && !next.some((d) => d.role === 'main')) next[0] = { ...next[0]!, role: 'main' };
        setDrafts(next);
    };

    const mains = drafts.filter((d) => d.role === 'main').length;
    const label = (draft: Draft, i: number) => {
        if (draft.role === 'featured') return `Featured artist ${i - mains + 1} of ${title}`;
        return drafts.length === 1 ? `Artist of ${title}` : `Artist ${i + 1} of ${title}`;
    };
    const full = drafts.length >= MAX_CREDITS;

    return (
        <form
            className="mt-1 flex flex-col gap-1"
            aria-label={`Artists of ${title}`}
            onSubmit={(e) => {
                e.preventDefault();
                save();
            }}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) save();
            }}
            onKeyDown={(e) => {
                if (e.key === 'Escape') onClose();
            }}
        >
            {drafts.map((draft, i) => {
                const sameRole = (j: number) => drafts[j]?.role === draft.role;
                return (
                    <CreditField
                        key={draft.key}
                        id={`artist-${video.id}-${draft.key}`}
                        label={label(draft, i)}
                        value={draft.name}
                        autoFocus={draft.key === focusKey}
                        onChange={(name) => change(draft.key, name)}
                        onMoveUp={sameRole(i - 1) ? () => move(i, i - 1) : null}
                        onMoveDown={sameRole(i + 1) ? () => move(i, i + 1) : null}
                        onRemove={drafts.length > 1 ? () => remove(draft.key) : null}
                    />
                );
            })}
            <div className="flex flex-wrap items-center gap-1">
                <button type="button" className="btn btn-ghost btn-xs" disabled={full} onClick={() => add('main')}>
                    <Icon name="plus" size={14} />
                    Add artist
                </button>
                <button type="button" className="btn btn-ghost btn-xs" disabled={full} onClick={() => add('featured')}>
                    <Icon name="plus" size={14} />
                    Add featured artist
                </button>
                <button type="submit" className="btn btn-primary btn-xs">
                    Save
                </button>
                <button type="button" className="btn btn-ghost btn-xs" onClick={onClose}>
                    Cancel
                </button>
            </div>
        </form>
    );
};

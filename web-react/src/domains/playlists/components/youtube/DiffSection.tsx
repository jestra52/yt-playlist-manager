interface DiffItem {
    youtubeId: string;
    title?: string;
    unavailable?: boolean;
}

export const DiffSection = ({ title, hint, items }: { title: string; hint: string; items: readonly DiffItem[] }) => (
    <details className="collapse-arrow rounded-box border-base-300 collapse border" open={items.length > 0}>
        <summary className="collapse-title py-2 text-sm font-semibold">
            {title} <span className="badge badge-sm ml-1">{items.length}</span>
        </summary>
        <div className="collapse-content text-sm">
            <p className="text-base-content/65 mt-0 mb-1">{hint}</p>
            <ul className="m-0 max-h-36 list-none overflow-y-auto p-0">
                {items.map((item) => (
                    <li key={item.youtubeId} className="truncate py-0.5">
                        {item.title || `YouTube video ${item.youtubeId}`}
                        {item.unavailable && <span className="text-base-content/65"> · deleted on YouTube</span>}
                    </li>
                ))}
            </ul>
        </div>
    </details>
);

import type { ReactNode } from 'react';

export const Collapsible = ({ title, children }: { title: string; children: ReactNode }) => (
    <details className="collapse-arrow rounded-box border-base-300 collapse mt-4 border">
        <summary className="collapse-title py-2 text-sm font-semibold" role="button">
            {title}
        </summary>
        <div className="collapse-content text-sm">{children}</div>
    </details>
);

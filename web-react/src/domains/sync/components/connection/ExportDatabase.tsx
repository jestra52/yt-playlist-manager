import { Icon } from '../../../../shared/components/Icon';
import { getDatabase } from '@ytpm/core/db/index';
import { downloadFile } from '../../../../shared/download';

const exportDatabase = () => {
    const bytes = getDatabase().export() as Uint8Array<ArrayBuffer>;
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`queue-${date}.sqlite`, new Blob([bytes], { type: 'application/vnd.sqlite3' }));
};

export const ExportDatabase = () => (
    <div className="text-base-content/65 mt-4 flex items-center justify-between gap-4 text-sm">
        <p className="m-0">Download a copy of everything as a SQLite file.</p>
        <button className="btn btn-ghost btn-sm" type="button" onClick={exportDatabase}>
            <Icon name="download" size={16} />
            Export database
        </button>
    </div>
);

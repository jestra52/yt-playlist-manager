import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import Button from '@mui/material/Button';
import { getDatabase } from '@ytpm/core/db/index';
import { downloadFile } from '../../../../shared/download';
import styles from './ExportDatabase.module.scss';

const exportDatabase = () => {
    const bytes = getDatabase().export() as Uint8Array<ArrayBuffer>;
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`queue-${date}.sqlite`, new Blob([bytes], { type: 'application/vnd.sqlite3' }));
};

export const ExportDatabase = () => (
    <div className={styles.export}>
        <p>Download a copy of everything as a SQLite file.</p>
        <Button size="small" color="inherit" startIcon={<FileDownloadOutlined />} onClick={exportDatabase}>
            Export database
        </Button>
    </div>
);

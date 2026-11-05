import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Chip from '@mui/material/Chip';
import styles from './DiffSection.module.scss';

interface DiffItem {
    youtubeId: string;
    title?: string;
    unavailable?: boolean;
}

export const DiffSection = ({ title, hint, items }: { title: string; hint: string; items: readonly DiffItem[] }) => (
    <Accordion defaultExpanded={items.length > 0} disableGutters className={styles.section}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} className={styles.summary}>
            <span className={styles.title}>{title}</span>
            <Chip size="small" label={items.length} />
        </AccordionSummary>
        <AccordionDetails>
            <p className={styles.hint}>{hint}</p>
            <ul className={styles.list}>
                {items.map((item) => (
                    <li key={item.youtubeId} className={styles.item}>
                        {item.title || `YouTube video ${item.youtubeId}`}
                        {item.unavailable && <span className={styles.hint}> · deleted on YouTube</span>}
                    </li>
                ))}
            </ul>
        </AccordionDetails>
    </Accordion>
);

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import type { ReactNode } from 'react';
import styles from './Collapsible.module.scss';

export const Collapsible = ({ title, children }: { title: string; children: ReactNode }) => (
    <Accordion disableGutters className={styles.section}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} className={styles.summary}>
            {title}
        </AccordionSummary>
        <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
);

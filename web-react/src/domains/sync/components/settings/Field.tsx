import type { ReactNode } from 'react';
import styles from './Field.module.scss';

interface FieldProps {
    label: string;
    hint?: ReactNode;
    problem?: string;
    children: ReactNode;
}

export const Field = ({ label, hint, problem, children }: FieldProps) => (
    <label className={styles.field}>
        <span className={styles.legend}>{label}</span>
        {children}
        {(problem || hint) && <span className={problem ? styles.problem : styles.hint}>{problem || hint}</span>}
    </label>
);

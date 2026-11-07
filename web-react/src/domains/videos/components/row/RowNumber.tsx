import type { Ref } from 'react';
import styles from './RowNumber.module.scss';

interface RowNumberProps {
    number: number;
    title: string;
    open: boolean;
    onClick: () => void;
    ref: Ref<HTMLButtonElement>;
}

const numberSize = (number: number) => {
    if (number >= 1000) return `${styles.number} ${styles.longer}`;
    return number >= 100 ? `${styles.number} ${styles.long}` : styles.number;
};

export const RowNumber = ({ number, title, open, onClick, ref }: RowNumberProps) => (
    <button
        ref={ref}
        type="button"
        className={`btn btn-ghost btn-square btn-lg ${styles.mark}`}
        aria-expanded={open}
        aria-label={`Position ${number}: move "${title}"`}
        title="Move to a position"
        onClick={onClick}
    >
        <span className={numberSize(number)}>{number}</span>
    </button>
);

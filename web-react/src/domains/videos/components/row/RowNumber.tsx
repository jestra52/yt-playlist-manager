import styles from './RowNumber.module.scss';

const numberSize = (number: number) => {
    if (number >= 1000) return `${styles.number} ${styles.longer}`;
    return number >= 100 ? `${styles.number} ${styles.long}` : styles.number;
};

export const RowNumber = ({ number }: { number: number }) => <span className={numberSize(number)}>{number}</span>;

import { Icon } from '../../../../shared/components/Icon';
import styles from './MissingThumb.module.scss';

export const MissingThumb = ({ unavailable }: { unavailable: boolean }) => (
    <div
        className={styles.thumb}
        title={
            unavailable
                ? 'Deleted or made private on YouTube: paste another link'
                : 'Not on YouTube yet: paste its link'
        }
    >
        <Icon name="link" size={22} />
        <span>{unavailable ? 'Deleted' : 'Missing'}</span>
    </div>
);

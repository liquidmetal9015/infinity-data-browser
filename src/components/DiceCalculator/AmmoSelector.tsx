// Ammo Toggle Chips
import { clsx } from 'clsx';
import { AMMO_LIST } from './types';
import styles from './AmmoSelector.module.css';

interface AmmoSelectorProps {
    ammo: string;
    ap: boolean;
    continuous: boolean;
    critImmune: boolean;
    cover?: boolean;
    onUpdate: (field: string, val: unknown) => void;
}

export const AmmoSelector = ({ ammo, ap, continuous, critImmune, cover, onUpdate }: AmmoSelectorProps) => (
    <div className={styles.ammoSelector}>
        <div className={styles.ammoRow}>
            {AMMO_LIST.map(a => (
                <button
                    key={a}
                    className={clsx(styles.ammoBtn, ammo === a && styles.active)}
                    onClick={() => onUpdate('ammo', a)}
                >
                    {a}
                </button>
            ))}
        </div>
        <div className={styles.ammoToggles}>
            <button
                className={clsx(styles.toggleBtn, ap && styles.active)}
                onClick={() => onUpdate('ap', !ap)}
            >
                AP
            </button>
            <button
                className={clsx(styles.toggleBtn, continuous && styles.active)}
                onClick={() => onUpdate('continuous', !continuous)}
            >
                CONT
            </button>
            <button
                className={clsx(styles.toggleBtn, critImmune && styles.active)}
                onClick={() => onUpdate('critImmune', !critImmune)}
            >
                CRIT IMMUNE
            </button>
            {cover !== undefined && (
                <button
                    className={clsx(styles.toggleBtn, cover && styles.active)}
                    onClick={() => onUpdate('cover', !cover)}
                >
                    COVER
                </button>
            )}
        </div>
    </div>
);

import { useState } from 'react';
import { ActivityTab } from './ActivityTab';
import styles from './ConnectedView.module.scss';
import { DevicesTab } from './DevicesTab';
import { SecurityTab } from './SecurityTab';
import { SettingsTab } from './SettingsTab';

type Section = 'devices' | 'security' | 'activity' | 'settings';

const SECTIONS: { id: Section; label: string }[] = [
    { id: 'devices', label: 'Devices' },
    { id: 'security', label: 'Security' },
    { id: 'activity', label: 'Activity' },
    { id: 'settings', label: 'Settings' },
];

export const ConnectedView = () => {
    const [section, setSection] = useState<Section>('devices');
    const [replacing, setReplacing] = useState(false);

    return (
        <>
            <p className="text-base-content/65 mt-0 mb-2 text-sm">
                This device is in a sync chain: your playlists sync with the other devices in it.
            </p>
            <div role="tablist" className="tabs tabs-border" aria-label="Sync chain">
                {SECTIONS.map(({ id, label }) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={section === id}
                        className={`tab ${section === id ? 'tab-active' : ''}`}
                        onClick={() => setSection(id)}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div key={section} role="tabpanel" className={styles.panel}>
                {section === 'devices' && (
                    <DevicesTab
                        onReplaceCode={() => {
                            setReplacing(true);
                            setSection('security');
                        }}
                    />
                )}
                {section === 'security' && <SecurityTab replacing={replacing} />}
                {section === 'activity' && <ActivityTab />}
                {section === 'settings' && <SettingsTab />}
            </div>
        </>
    );
};

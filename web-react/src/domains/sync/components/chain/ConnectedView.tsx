import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useState } from 'react';
import { ActivityTab } from './ActivityTab';
import styles from './ConnectedView.module.scss';
import { DevicesTab } from './DevicesTab';
import { SecurityTab } from './SecurityTab';
import { SettingsTab } from './SettingsTab';

type Section = 'devices' | 'security' | 'activity' | 'settings';

export const ConnectedView = () => {
    const [section, setSection] = useState<Section>('devices');
    const [replacing, setReplacing] = useState(false);

    return (
        <>
            <p className={styles.intro}>
                This device is in a sync chain: your playlists sync with the other devices in it.
            </p>
            <Tabs
                value={section}
                onChange={(_, value: Section) => setSection(value)}
                variant="scrollable"
                scrollButtons={false}
                aria-label="Sync chain"
                className={styles.tabs}
            >
                <Tab value="devices" label="Devices" />
                <Tab value="security" label="Security" />
                <Tab value="activity" label="Activity" />
                <Tab value="settings" label="Settings" />
            </Tabs>
            <div role="tabpanel" className={styles.panel}>
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

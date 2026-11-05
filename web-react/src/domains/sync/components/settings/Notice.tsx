import type { AriaRole, ReactNode } from 'react';
import { Icon } from '../../../../shared/components/Icon';

interface NoticeProps {
    tone: 'info' | 'warning';
    role?: AriaRole;
    labelledBy?: string;
    icon?: ReactNode;
    children: ReactNode;
}

export const Notice = ({ tone, role, labelledBy, icon, children }: NoticeProps) => (
    <div
        role={role}
        aria-labelledby={labelledBy}
        className={`alert alert-soft mb-3 items-start text-sm ${tone === 'info' ? 'alert-info' : 'alert-warning'}`}
    >
        {icon ?? <Icon name="info" size={18} />}
        <div>{children}</div>
    </div>
);

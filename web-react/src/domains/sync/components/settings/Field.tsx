import type { ReactNode } from 'react';

interface FieldProps {
    label: string;
    hint?: ReactNode;
    problem?: string;
    children: ReactNode;
}

export const Field = ({ label, hint, problem, children }: FieldProps) => (
    <label className="fieldset">
        <span className="fieldset-legend">{label}</span>
        {children}
        {(problem || hint) && (
            <span className={`label whitespace-normal ${problem ? 'text-error' : ''}`}>{problem || hint}</span>
        )}
    </label>
);

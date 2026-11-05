import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';

describe('Icon', () => {
    it('draws outlines at the default size, hidden from screen readers', () => {
        const { container } = render(<Icon name="close" />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('aria-hidden', 'true');
        expect(svg).toHaveAttribute('width', '18');
        expect(svg).toHaveAttribute('fill', 'none');
    });

    it('fills the solid icons', () => {
        const { container } = render(<Icon name="play" size={24} />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('width', '24');
        expect(svg).toHaveAttribute('fill', 'currentColor');
    });
});

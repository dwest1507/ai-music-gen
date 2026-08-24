import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import React from 'react';

describe('AmbientBackground', () => {
    it('renders a decorative, non-interactive layer', () => {
        const { container } = render(<AmbientBackground />);
        const root = container.firstElementChild as HTMLElement;

        expect(root).not.toBeNull();
        expect(root.getAttribute('aria-hidden')).toBe('true');
        expect(root.className).toContain('pointer-events-none');
        expect(root.className).toContain('fixed');
    });

    it('renders the gradient base plus the ambient blobs', () => {
        const { container } = render(<AmbientBackground />);
        const root = container.firstElementChild as HTMLElement;

        expect(root.children).toHaveLength(5);
    });
});

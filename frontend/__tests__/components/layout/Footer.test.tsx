import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Footer } from '@/components/layout/Footer';
import React from 'react';

vi.mock('next/link', () => ({
    default: ({
        children,
        href,
        className,
        target,
        rel,
    }: {
        children: React.ReactNode;
        href: string;
        className?: string;
        target?: string;
        rel?: string;
    }) => (
        <a href={href} className={className} target={target} rel={rel}>
            {children}
        </a>
    ),
}));

describe('Footer', () => {
    it('renders the copyright with the current year', () => {
        render(<Footer />);
        expect(
            screen.getByText(`© ${new Date().getFullYear()} David West`)
        ).toBeInTheDocument();
    });

    it('renders email, GitHub and LinkedIn links', () => {
        render(<Footer />);
        expect(screen.getByRole('link', { name: /email/i }).getAttribute('href')).toBe(
            'mailto:david.p.west2@gmail.com'
        );
        expect(screen.getByRole('link', { name: /github/i }).getAttribute('href')).toBe(
            'https://github.com/dwest1507/ai-music-gen'
        );
        expect(screen.getByRole('link', { name: /linkedin/i }).getAttribute('href')).toBe(
            'https://www.linkedin.com/in/david-west-277509b1/'
        );
    });

    it('opens external links safely in a new tab', () => {
        render(<Footer />);
        const github = screen.getByRole('link', { name: /github/i });
        expect(github.getAttribute('target')).toBe('_blank');
        expect(github.getAttribute('rel')).toBe('noopener noreferrer');
    });
});

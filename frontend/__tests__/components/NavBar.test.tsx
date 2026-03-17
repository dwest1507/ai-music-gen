import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NavBar } from '@/components/NavBar';
import React from 'react';

vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/'),
}));

vi.mock('next/link', () => ({
    default: ({
        children,
        href,
        className,
    }: {
        children: React.ReactNode;
        href: string;
        className?: string;
    }) => (
        <a href={href} className={className}>
            {children}
        </a>
    ),
}));

vi.mock('lucide-react', () => ({
    Music: () => <svg data-testid="music-icon" />,
}));

describe('NavBar', () => {
    it('renders brand link', () => {
        render(<NavBar />);
        const brand = screen.getByRole('link', { name: /ai music gen/i });
        expect(brand).toBeDefined();
        expect(brand.getAttribute('href')).toBe('/');
    });

    it('renders Generator and About nav links', () => {
        render(<NavBar />);
        const generatorLink = screen.getByRole('link', { name: /generator/i });
        const aboutLink = screen.getByRole('link', { name: /about/i });
        expect(generatorLink.getAttribute('href')).toBe('/');
        expect(aboutLink.getAttribute('href')).toBe('/about');
    });

    it('applies active style to Generator link when on /', () => {
        render(<NavBar />);
        const generatorLink = screen.getByRole('link', { name: /generator/i });
        expect(generatorLink.className).toContain('text-primary');
        expect(generatorLink.className).toContain('font-semibold');
    });

    it('applies inactive style to About link when on /', () => {
        render(<NavBar />);
        const aboutLink = screen.getByRole('link', { name: /about/i });
        expect(aboutLink.className).toContain('text-muted-foreground');
    });

    it('applies active style to About link when on /about', async () => {
        const { usePathname } = await import('next/navigation');
        vi.mocked(usePathname).mockReturnValue('/about');

        render(<NavBar />);
        const aboutLink = screen.getByRole('link', { name: /about/i });
        expect(aboutLink.className).toContain('text-primary');
        expect(aboutLink.className).toContain('font-semibold');
    });

    it('applies inactive style to Generator link when on /about', async () => {
        const { usePathname } = await import('next/navigation');
        vi.mocked(usePathname).mockReturnValue('/about');

        render(<NavBar />);
        const generatorLink = screen.getByRole('link', { name: /generator/i });
        expect(generatorLink.className).toContain('text-muted-foreground');
    });
});

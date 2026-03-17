import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import About from '@/app/about/page';
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

vi.mock('lucide-react', () => ({
    ArrowRight: () => <svg data-testid="arrow-right-icon" />,
    Cpu: () => <svg data-testid="cpu-icon" />,
    Server: () => <svg data-testid="server-icon" />,
    LayoutTemplate: () => <svg data-testid="layout-icon" />,
    Shield: () => <svg data-testid="shield-icon" />,
    Github: () => <svg data-testid="github-icon" />,
}));

vi.mock('@/components/ui/badge', () => ({
    Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/card', () => ({
    Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div className={className}>{children}</div>
    ),
    CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div className={className}>{children}</div>
    ),
    CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <h3 className={className}>{children}</h3>
    ),
    CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div className={className}>{children}</div>
    ),
}));

describe('About page', () => {
    it('renders the main heading', () => {
        render(<About />);
        expect(screen.getByRole('heading', { name: /about this project/i })).toBeDefined();
    });

    it('renders System Architecture heading', () => {
        render(<About />);
        expect(screen.getByRole('heading', { name: /system architecture/i })).toBeDefined();
    });

    it('renders Tech Stack heading', () => {
        render(<About />);
        expect(screen.getByRole('heading', { name: /tech stack/i })).toBeDefined();
    });

    it('renders all four architecture layer labels', () => {
        render(<About />);
        expect(screen.getByText('Browser')).toBeDefined();
        // "Next.js 16" and "FastAPI" also appear as badges, so multiple elements exist
        expect(screen.getAllByText('Next.js 16').length).toBeGreaterThan(0);
        expect(screen.getAllByText('FastAPI').length).toBeGreaterThan(0);
        expect(screen.getByText('ACE-Step API')).toBeDefined();
    });

    it('renders AI Inference card', () => {
        render(<About />);
        expect(screen.getByRole('heading', { name: /ai inference/i })).toBeDefined();
        expect(screen.getByText(/modal \(serverless gpu\)/i)).toBeDefined();
    });

    it('renders Backend API card', () => {
        render(<About />);
        expect(screen.getByRole('heading', { name: /backend api/i })).toBeDefined();
        expect(screen.getByText(/fastapi on railway/i)).toBeDefined();
    });

    it('renders Frontend card', () => {
        render(<About />);
        expect(screen.getByRole('heading', { name: /frontend/i })).toBeDefined();
        expect(screen.getByText(/next\.js on vercel/i)).toBeDefined();
    });

    it('renders CI/CD & DevOps card', () => {
        render(<About />);
        expect(screen.getByRole('heading', { name: /ci\/cd & devops/i })).toBeDefined();
        // "GitHub Actions" appears in both the subtitle and as a badge
        expect(screen.getAllByText(/github actions/i).length).toBeGreaterThan(0);
    });

    it('renders GitHub links', () => {
        render(<About />);
        const links = screen.getAllByRole('link');
        const hrefs = links.map((l) => l.getAttribute('href'));
        expect(hrefs).toContain('https://github.com/dwest1507/ai-music-gen');
        expect(hrefs).toContain('https://github.com/dwest1507/ACE-Step-1.5-modal/tree/feature/modal-support');
    });

    it('renders fork link in AI Inference card', () => {
        render(<About />);
        const forkLink = screen.getByRole('link', { name: /view fork on github/i });
        expect(forkLink.getAttribute('href')).toBe('https://github.com/dwest1507/ACE-Step-1.5-modal/tree/feature/modal-support');
    });

    it('renders key technology badges', () => {
        render(<About />);
        expect(screen.getByText('ACE-Step v1.5')).toBeDefined();
        // "Next.js 16" also appears in the architecture diagram
        expect(screen.getAllByText('Next.js 16').length).toBeGreaterThan(0);
        expect(screen.getByText('Trivy')).toBeDefined();
        expect(screen.getByText('Release Please')).toBeDefined();
    });

    it('renders developer footer', () => {
        render(<About />);
        expect(screen.getByText(/developed by/i)).toBeDefined();
        expect(screen.getByRole('link', { name: /david west/i })).toBeDefined();
    });
});

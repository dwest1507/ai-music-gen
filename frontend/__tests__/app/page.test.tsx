import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import Home from '@/app/page';

vi.mock('@/components/MusicGeneratorForm', () => ({
    MusicGeneratorForm: ({ onJobCreated }: { onJobCreated: (id: string) => void }) => (
        <button onClick={() => onJobCreated('job-123')}>Submit Form</button>
    ),
}));

vi.mock('@/components/JobStatus', () => ({
    JobStatus: ({ jobId }: { jobId: string }) => <div data-testid="job-status">{jobId}</div>,
}));

vi.mock('lucide-react', () => ({
    Music: () => <svg data-testid="music-icon" />,
}));

describe('Home page', () => {
    it('renders the form when no job is active', () => {
        render(<Home />);
        expect(screen.getByText('AI Music Generator')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Submit Form/i })).toBeInTheDocument();
        expect(screen.queryByTestId('job-status')).not.toBeInTheDocument();
    });

    it('shows job status after a job is created', () => {
        render(<Home />);
        fireEvent.click(screen.getByRole('button', { name: /Submit Form/i }));

        expect(screen.getByTestId('job-status')).toHaveTextContent('job-123');
        expect(screen.queryByRole('button', { name: /Submit Form/i })).not.toBeInTheDocument();
    });

    it('returns to the form when "Generate Another Song" is clicked', () => {
        render(<Home />);
        fireEvent.click(screen.getByRole('button', { name: /Submit Form/i }));

        fireEvent.click(screen.getByRole('button', { name: /Generate Another Song/i }));

        expect(screen.getByRole('button', { name: /Submit Form/i })).toBeInTheDocument();
        expect(screen.queryByTestId('job-status')).not.toBeInTheDocument();
    });
});

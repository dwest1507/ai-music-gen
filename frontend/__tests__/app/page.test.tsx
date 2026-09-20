import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import Home from '@/app/page';

vi.mock('@/components/MusicGeneratorWizard', () => ({
    MusicGeneratorWizard: ({ onJobCreated }: { onJobCreated: (id: string) => void }) => (
        <button onClick={() => onJobCreated('job-123')}>Submit Wizard</button>
    ),
}));

vi.mock('@/components/JobStatus', () => ({
    JobStatus: ({ jobId }: { jobId: string }) => <div data-testid="job-status">{jobId}</div>,
}));

vi.mock('lucide-react', () => ({
    Music: () => <svg data-testid="music-icon" />,
}));

describe('Home page', () => {
    it('renders the wizard when no job is active', () => {
        render(<Home />);
        expect(screen.getByText('AI Music Generator')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Submit Wizard/i })).toBeInTheDocument();
        expect(screen.queryByTestId('job-status')).not.toBeInTheDocument();
    });

    it('shows job status after a job is created', () => {
        render(<Home />);
        fireEvent.click(screen.getByRole('button', { name: /Submit Wizard/i }));

        expect(screen.getByTestId('job-status')).toHaveTextContent('job-123');
        expect(screen.queryByRole('button', { name: /Submit Wizard/i })).not.toBeInTheDocument();
    });

    it('returns to the wizard when "Generate Another Song" is clicked', () => {
        render(<Home />);
        fireEvent.click(screen.getByRole('button', { name: /Submit Wizard/i }));

        fireEvent.click(screen.getByRole('button', { name: /Generate Another Song/i }));

        expect(screen.getByRole('button', { name: /Submit Wizard/i })).toBeInTheDocument();
        expect(screen.queryByTestId('job-status')).not.toBeInTheDocument();
    });
});

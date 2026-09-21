import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import Home from '@/app/page';
import { apiFetch, enhancePrompt } from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/api')>();
    return { ...actual, apiFetch: vi.fn(), enhancePrompt: vi.fn() };
});

vi.mock('@/lib/prewarm', () => ({ startPrewarm: () => () => {} }));

vi.mock('@/components/JobStatus', () => ({
    JobStatus: ({ jobId }: { jobId: string }) => <div data-testid="job-status">{jobId}</div>,
}));

describe('Prompt enhancement lifecycle across songs (#84)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('"Generate Another Song" starts a fresh wizard with all 3 enhancements and no leftover prompt', async () => {
        vi.mocked(enhancePrompt).mockResolvedValue({ prompt: 'Pop punk, 180 BPM, power chords' });
        vi.mocked(apiFetch).mockResolvedValue({ task_id: 'job-1', status: 'queued' });
        render(<Home />);

        fireEvent.change(screen.getByRole('textbox', { name: /prompt/i }), {
            target: { value: 'Make a pop punk song about being a dad' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Enhance Prompt/i }));
        await waitFor(() => expect(screen.getByText(/2 left/i)).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
        fireEvent.click(screen.getByRole('button', { name: /Instrumental/i }));
        fireEvent.click(screen.getByRole('button', { name: /Generate Song/i }));
        await screen.findByTestId('job-status');

        fireEvent.click(screen.getByRole('button', { name: /Generate Another Song/i }));

        expect(screen.getByText(/3 left/i)).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /prompt/i })).toHaveValue('');
        expect(screen.queryByRole('button', { name: /Revert to Original/i })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Enhance Prompt/i })).toBeEnabled();
    });
});

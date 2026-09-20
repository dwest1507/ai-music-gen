import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { MusicGeneratorWizard } from '@/components/MusicGeneratorWizard';
import { apiFetch, getRandomExample } from '@/lib/api';
import React from 'react';

// Mock dependencies
vi.mock('@/lib/api', () => ({
    apiFetch: vi.fn(),
    getRandomExample: vi.fn(),
}));

const mockApiFetch = apiFetch as MockedFunction<typeof apiFetch>;
const mockGetRandomExample = getRandomExample as MockedFunction<typeof getRandomExample>;

describe('MusicGeneratorWizard - Step 1', () => {
    const mockOnJobCreated = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders Step 1 with prompt input, Try an Example button, and step indicator', () => {
        render(<MusicGeneratorWizard onJobCreated={mockOnJobCreated} />);

        expect(screen.getByText(/Create Music/i)).toBeInTheDocument();
        expect(screen.getByText(/Step 1 of 3/i)).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /prompt/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Try an Example/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Next|Continue/i })).toBeInTheDocument();
    });

    it('displays a validation error when attempting to advance with a prompt shorter than 3 characters', async () => {
        render(<MusicGeneratorWizard onJobCreated={mockOnJobCreated} />);

        const promptInput = screen.getByRole('textbox', { name: /prompt/i });
        fireEvent.change(promptInput, { target: { value: 'ab' } });

        const nextButton = screen.getByRole('button', { name: /Next|Continue/i });
        fireEvent.click(nextButton);

        await waitFor(() => {
            expect(screen.getByText(/Prompt must be at least 3 characters/i)).toBeInTheDocument();
        });
    });

    it('loads an example into the prompt on Step 1 without advancing to Step 2', async () => {
        mockGetRandomExample.mockResolvedValue({
            prompt: 'An upbeat indie track with sparkling guitars',
            lyrics: '[Verse 1]\nWalking down the sunny street',
            vocal_language: 'en',
            instrumental: false,
        });

        render(<MusicGeneratorWizard onJobCreated={mockOnJobCreated} />);

        const exampleButton = screen.getByRole('button', { name: /Try an Example/i });
        fireEvent.click(exampleButton);

        await waitFor(() => {
            const promptInput = screen.getByRole('textbox', { name: /prompt/i });
            expect(promptInput).toHaveValue('An upbeat indie track with sparkling guitars');
        });

        // Verifies it did NOT automatically advance steps
        expect(screen.getByText(/Step 1 of 3/i)).toBeInTheDocument();
        expect(screen.queryByText(/Choose Song Type/i)).not.toBeInTheDocument();
    });

    it('shows an error message when Try an Example fails', async () => {
        mockGetRandomExample.mockRejectedValue(new Error('Network error'));

        render(<MusicGeneratorWizard onJobCreated={mockOnJobCreated} />);

        const exampleButton = screen.getByRole('button', { name: /Try an Example/i });
        fireEvent.click(exampleButton);

        await waitFor(() => {
            expect(screen.getByText(/Failed to fetch example prompt/i)).toBeInTheDocument();
        });
    });
});

describe('MusicGeneratorWizard - Step 2 Navigation & Preservation', () => {
    const mockOnJobCreated = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('advances from Step 1 to Step 2 with valid prompt', () => {
        render(<MusicGeneratorWizard onJobCreated={mockOnJobCreated} />);

        const promptInput = screen.getByRole('textbox', { name: /prompt/i });
        fireEvent.change(promptInput, { target: { value: 'Synthwave dream pop with lush pads' } });

        const nextButton = screen.getByRole('button', { name: /Next|Continue/i });
        fireEvent.click(nextButton);

        expect(screen.getByText(/Step 2 of 3/i)).toBeInTheDocument();
        expect(screen.getByText(/Choose Song Type/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Song with Lyrics/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Instrumental/i })).toBeInTheDocument();
    });

    it('navigates Back from Step 2 to Step 1 and preserves entered prompt text', () => {
        render(<MusicGeneratorWizard onJobCreated={mockOnJobCreated} />);

        const promptInput = screen.getByRole('textbox', { name: /prompt/i });
        fireEvent.change(promptInput, { target: { value: 'Synthwave dream pop with lush pads' } });

        const nextButton = screen.getByRole('button', { name: /Next|Continue/i });
        fireEvent.click(nextButton);

        expect(screen.getByText(/Step 2 of 3/i)).toBeInTheDocument();

        const backButton = screen.getByRole('button', { name: /Back/i });
        fireEvent.click(backButton);

        expect(screen.getByText(/Step 1 of 3/i)).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /prompt/i })).toHaveValue(
            'Synthwave dream pop with lush pads'
        );
    });
});

describe('MusicGeneratorWizard - Step 3 Instrumental Flow & Submission', () => {
    const mockOnJobCreated = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const advanceToStep3 = (promptText = 'A cinematic Hans Zimmer style soundtrack') => {
        render(<MusicGeneratorWizard onJobCreated={mockOnJobCreated} />);
        const promptInput = screen.getByRole('textbox', { name: /prompt/i });
        fireEvent.change(promptInput, { target: { value: promptText } });

        const nextButton = screen.getByRole('button', { name: /Next|Continue/i });
        fireEvent.click(nextButton);

        const instrumentalBtn = screen.getByRole('button', { name: /Instrumental/i });
        fireEvent.click(instrumentalBtn);
    };

    it('selecting Instrumental advances to Step 3 with prompt summary and confirmation', () => {
        advanceToStep3();

        expect(screen.getByText(/Step 3 of 3/i)).toBeInTheDocument();
        expect(screen.getByText(/Review & Confirmation/i)).toBeInTheDocument();
        expect(screen.getByText(/"A cinematic Hans Zimmer style soundtrack"/i)).toBeInTheDocument();
        expect(screen.getByText(/Instrumental \(No Vocals\)/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Generate Song/i })).toBeInTheDocument();
    });

    it('navigating Back from Step 3 returns to Step 2', () => {
        advanceToStep3();

        expect(screen.getByText(/Step 3 of 3/i)).toBeInTheDocument();

        const backButton = screen.getByRole('button', { name: /Back/i });
        fireEvent.click(backButton);

        expect(screen.getByText(/Step 2 of 3/i)).toBeInTheDocument();
        expect(screen.getByText(/Choose Song Type/i)).toBeInTheDocument();
    });

    it('submitting instrumental sends lyrics "[Instrumental]", instrumental true, vocal_language "en", and calls onJobCreated', async () => {
        mockApiFetch.mockResolvedValue({
            task_id: 'task-inst-456',
            status: 'queued',
        });

        advanceToStep3();

        const submitButton = screen.getByRole('button', { name: /Generate Song/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockApiFetch).toHaveBeenCalledTimes(1);
        });

        const [url, options] = mockApiFetch.mock.calls[0];
        expect(url).toBe('/api/generate');
        expect(options?.method).toBe('POST');

        const parsedBody = JSON.parse(options?.body as string);
        expect(parsedBody).toEqual({
            prompt: 'A cinematic Hans Zimmer style soundtrack',
            lyrics: '[Instrumental]',
            instrumental: true,
            vocal_language: 'en',
        });

        expect(mockOnJobCreated).toHaveBeenCalledWith('task-inst-456');
    });

    it('displays error message when generation submission fails', async () => {
        mockApiFetch.mockRejectedValue(new Error('Generation queue full'));

        advanceToStep3();

        const submitButton = screen.getByRole('button', { name: /Generate Song/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/Generation queue full/i)).toBeInTheDocument();
        });

        expect(mockOnJobCreated).not.toHaveBeenCalled();
    });
});

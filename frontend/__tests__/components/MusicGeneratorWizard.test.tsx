import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { MusicGeneratorWizard } from '@/components/MusicGeneratorWizard';
import { apiFetch, getRandomExample, generateLyrics } from '@/lib/api';
import React from 'react';

// Mock dependencies
vi.mock('@/lib/api', () => ({
    apiFetch: vi.fn(),
    getRandomExample: vi.fn(),
    generateLyrics: vi.fn(),
}));

const mockApiFetch = apiFetch as MockedFunction<typeof apiFetch>;
const mockGetRandomExample = getRandomExample as MockedFunction<typeof getRandomExample>;
const mockGenerateLyrics = generateLyrics as MockedFunction<typeof generateLyrics>;


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

describe('MusicGeneratorWizard - Step 3 Lyric Review & Generation', () => {
    const mockOnJobCreated = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const advanceToStep3WithLyrics = (promptText = 'An indie rock anthem about summer') => {
        render(<MusicGeneratorWizard onJobCreated={mockOnJobCreated} />);
        const promptInput = screen.getByRole('textbox', { name: /prompt/i });
        fireEvent.change(promptInput, { target: { value: promptText } });

        const nextButton = screen.getByRole('button', { name: /Next|Continue/i });
        fireEvent.click(nextButton);

        const lyricsBtn = screen.getByRole('button', { name: /Song with Lyrics/i });
        fireEvent.click(lyricsBtn);
    };

    it('entering Step 3 with Song with Lyrics triggers lyric generation and displays loading skeleton', async () => {
        let resolveLyrics: (val: { lyrics: string }) => void;
        const lyricsPromise = new Promise<{ lyrics: string }>((resolve) => {
            resolveLyrics = resolve;
        });
        mockGenerateLyrics.mockReturnValue(lyricsPromise);

        advanceToStep3WithLyrics('An indie rock anthem about summer');

        expect(screen.getByText(/Writing song lyrics with AI/i)).toBeInTheDocument();
        expect(mockGenerateLyrics).toHaveBeenCalledWith('An indie rock anthem about summer');

        // Resolve lyrics
        resolveLyrics!({ lyrics: '[Verse 1]\nSun on the pavement\n\n[Chorus]\nNever looking back' });

        await waitFor(() => {
            expect(screen.queryByText(/Writing song lyrics with AI/i)).not.toBeInTheDocument();
            expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue(
                '[Verse 1]\nSun on the pavement\n\n[Chorus]\nNever looking back'
            );
        });
    });

    it('preserves premade lyrics from an example without calling generateLyrics if prompt was not modified', async () => {
        mockGetRandomExample.mockResolvedValue({
            prompt: 'An upbeat indie track with sparkling guitars',
            lyrics: '[Verse 1]\nWalking down the sunny street',
            vocal_language: 'en',
            instrumental: false,
        });

        render(<MusicGeneratorWizard onJobCreated={mockOnJobCreated} />);

        const exampleBtn = screen.getByRole('button', { name: /Try an Example/i });
        fireEvent.click(exampleBtn);

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /prompt/i })).toHaveValue(
                'An upbeat indie track with sparkling guitars'
            );
        });

        const nextButton = screen.getByRole('button', { name: /Next|Continue/i });
        fireEvent.click(nextButton);

        const lyricsBtn = screen.getByRole('button', { name: /Song with Lyrics/i });
        fireEvent.click(lyricsBtn);

        expect(mockGenerateLyrics).not.toHaveBeenCalled();
        expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue(
            '[Verse 1]\nWalking down the sunny street'
        );
    });

    it('modifying an example prompt discards premade lyrics and generates fresh AI lyrics', async () => {
        mockGetRandomExample.mockResolvedValue({
            prompt: 'An upbeat indie track with sparkling guitars',
            lyrics: '[Verse 1]\nWalking down the sunny street',
            vocal_language: 'en',
            instrumental: false,
        });
        mockGenerateLyrics.mockResolvedValue({
            lyrics: '[Verse 1]\nFresh generated stanzas for modified prompt',
        });

        render(<MusicGeneratorWizard onJobCreated={mockOnJobCreated} />);

        const exampleBtn = screen.getByRole('button', { name: /Try an Example/i });
        fireEvent.click(exampleBtn);

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /prompt/i })).toHaveValue(
                'An upbeat indie track with sparkling guitars'
            );
        });

        const promptInput = screen.getByRole('textbox', { name: /prompt/i });
        fireEvent.change(promptInput, {
            target: { value: 'An upbeat indie track with heavy synthesizer leads' },
        });

        const nextButton = screen.getByRole('button', { name: /Next|Continue/i });
        fireEvent.click(nextButton);

        const lyricsBtn = screen.getByRole('button', { name: /Song with Lyrics/i });
        fireEvent.click(lyricsBtn);

        expect(mockGenerateLyrics).toHaveBeenCalledWith(
            'An upbeat indie track with heavy synthesizer leads'
        );

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue(
                '[Verse 1]\nFresh generated stanzas for modified prompt'
            );
        });
    });

    it('navigating back and returning preserves generated and edited lyrics without redundant API calls', async () => {
        mockGenerateLyrics.mockResolvedValue({
            lyrics: '[Verse 1]\nNeon highway',
        });

        render(<MusicGeneratorWizard onJobCreated={mockOnJobCreated} />);

        // Step 1: enter prompt
        const promptInput = screen.getByRole('textbox', { name: /prompt/i });
        fireEvent.change(promptInput, { target: { value: 'A synthwave journey' } });
        const nextButton = screen.getByRole('button', { name: /Next|Continue/i });
        fireEvent.click(nextButton);

        // Step 2: choose Song with Lyrics -> Step 3
        const lyricsBtn = screen.getByRole('button', { name: /Song with Lyrics/i });
        fireEvent.click(lyricsBtn);

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue(
                '[Verse 1]\nNeon highway'
            );
        });
        expect(mockGenerateLyrics).toHaveBeenCalledTimes(1);

        // Edit the lyrics
        const lyricsTextarea = screen.getByRole('textbox', { name: /lyrics/i });
        fireEvent.change(lyricsTextarea, {
            target: { value: '[Verse 1]\nNeon highway edited by user' },
        });

        // Navigate Back to Step 2
        const backBtnStep3 = screen.getByRole('button', { name: /Back/i });
        fireEvent.click(backBtnStep3);

        expect(screen.getByText(/Step 2 of 3/i)).toBeInTheDocument();

        // Navigate Back to Step 1
        const backBtnStep2 = screen.getByRole('button', { name: /Back/i });
        fireEvent.click(backBtnStep2);

        expect(screen.getByText(/Step 1 of 3/i)).toBeInTheDocument();

        // Advance to Step 2 without modifying prompt
        const continueBtn = screen.getByRole('button', { name: /Next|Continue/i });
        fireEvent.click(continueBtn);

        // Select Song with Lyrics -> Step 3
        const lyricsBtnAgain = screen.getByRole('button', { name: /Song with Lyrics/i });
        fireEvent.click(lyricsBtnAgain);

        expect(screen.getByText(/Step 3 of 3/i)).toBeInTheDocument();

        // Must still have edited lyrics, and generateLyrics must NOT have been called again
        expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue(
            '[Verse 1]\nNeon highway edited by user'
        );
        expect(mockGenerateLyrics).toHaveBeenCalledTimes(1);
    });

    it('submitting with explicit lyrics sends lyrics and vocal_language en to /api/generate', async () => {
        mockGenerateLyrics.mockResolvedValue({
            lyrics: '[Verse 1]\nDancing in the starlight\n\n[Chorus]\nStarlight night',
        });
        mockApiFetch.mockResolvedValue({
            task_id: 'task-lyrics-789',
            status: 'queued',
        });

        advanceToStep3WithLyrics('A funky disco track');

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue(
                '[Verse 1]\nDancing in the starlight\n\n[Chorus]\nStarlight night'
            );
        });

        const submitButton = screen.getByRole('button', { name: /Generate Song/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockApiFetch).toHaveBeenCalledTimes(1);
        });

        const [url, options] = mockApiFetch.mock.calls[0];
        expect(url).toBe('/api/generate');
        const parsedBody = JSON.parse(options?.body as string);
        expect(parsedBody).toEqual({
            prompt: 'A funky disco track',
            vocal_language: 'en',
            lyrics: '[Verse 1]\nDancing in the starlight\n\n[Chorus]\nStarlight night',
        });
        expect(parsedBody.instrumental).toBeUndefined();
        expect(mockOnJobCreated).toHaveBeenCalledWith('task-lyrics-789');
    });

    it('clearing the lyrics textarea falls back to instrumental submission', async () => {
        mockGenerateLyrics.mockResolvedValue({
            lyrics: '[Verse 1]\nSome lyrics to delete',
        });
        mockApiFetch.mockResolvedValue({
            task_id: 'task-fallback-999',
            status: 'queued',
        });

        advanceToStep3WithLyrics('Ambient electronic soundscape');

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue(
                '[Verse 1]\nSome lyrics to delete'
            );
        });

        // Clear all text in textarea
        const lyricsTextarea = screen.getByRole('textbox', { name: /lyrics/i });
        fireEvent.change(lyricsTextarea, { target: { value: '   ' } });

        const submitButton = screen.getByRole('button', { name: /Generate Song/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockApiFetch).toHaveBeenCalledTimes(1);
        });

        const [url, options] = mockApiFetch.mock.calls[0];
        expect(url).toBe('/api/generate');
        const parsedBody = JSON.parse(options?.body as string);
        expect(parsedBody).toEqual({
            prompt: 'Ambient electronic soundscape',
            vocal_language: 'en',
            lyrics: '[Instrumental]',
            instrumental: true,
        });
        expect(mockOnJobCreated).toHaveBeenCalledWith('task-fallback-999');
    });

    it('degrades gracefully to manual entry when lyric generation fails with 503', async () => {
        mockGenerateLyrics.mockRejectedValue(
            new Error('AI lyric service is not configured')
        );

        advanceToStep3WithLyrics('A blues song about rainy days');

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(
                screen.getByText(/AI lyric service is not configured/i)
            ).toBeInTheDocument();
        });

        // The textarea is still rendered for manual entry
        const textarea = screen.getByRole('textbox', { name: /lyrics/i });
        expect(textarea).toBeInTheDocument();
        fireEvent.change(textarea, { target: { value: '[Verse 1]\nMy custom blues lyrics' } });
        expect(textarea).toHaveValue('[Verse 1]\nMy custom blues lyrics');
    });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { MusicGeneratorWizard } from '@/components/MusicGeneratorWizard';
import { apiFetch, getRandomExample, generateLyrics, formatLyrics, enhancePrompt, ApiError } from '@/lib/api';
import React from 'react';

// Mock dependencies
vi.mock('@/lib/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/api')>();
    return {
        ...actual,
        apiFetch: vi.fn(),
        getRandomExample: vi.fn(),
        generateLyrics: vi.fn(),
        formatLyrics: vi.fn(),
        enhancePrompt: vi.fn(),
    };
});

const mockApiFetch = apiFetch as MockedFunction<typeof apiFetch>;
const mockGetRandomExample = getRandomExample as MockedFunction<typeof getRandomExample>;
const mockGenerateLyrics = generateLyrics as MockedFunction<typeof generateLyrics>;
const mockFormatLyrics = formatLyrics as MockedFunction<typeof formatLyrics>;
const mockEnhancePrompt = enhancePrompt as MockedFunction<typeof enhancePrompt>;


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
        expect(mockGenerateLyrics).toHaveBeenCalledWith('An indie rock anthem about summer', undefined);

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
            'An upbeat indie track with heavy synthesizer leads',
            undefined
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

describe('MusicGeneratorWizard - Auto-Formatting for Edited Lyrics (#87)', () => {
    const mockOnJobCreated = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const advanceToStep3WithLyrics = (promptText = 'A synthwave ballad') => {
        render(<MusicGeneratorWizard onJobCreated={mockOnJobCreated} />);
        const promptInput = screen.getByRole('textbox', { name: /prompt/i });
        fireEvent.change(promptInput, { target: { value: promptText } });

        const nextButton = screen.getByRole('button', { name: /Next|Continue/i });
        fireEvent.click(nextButton);

        const lyricsBtn = screen.getByRole('button', { name: /Song with Lyrics/i });
        fireEvent.click(lyricsBtn);
    };

    it('unedited lyrics skip the format-lyrics call on submission', async () => {
        mockGenerateLyrics.mockResolvedValueOnce({
            lyrics: '[Verse 1]\nOriginal pristine lyrics',
        });
        mockApiFetch.mockResolvedValueOnce({ task_id: 'job-unedited-1' });

        advanceToStep3WithLyrics('A pristine song');

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue(
                '[Verse 1]\nOriginal pristine lyrics'
            );
        });

        const generateBtn = screen.getByRole('button', { name: /Generate Song/i });
        fireEvent.click(generateBtn);

        await waitFor(() => {
            expect(mockApiFetch).toHaveBeenCalledWith('/api/generate', expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('[Verse 1]\\nOriginal pristine lyrics'),
            }));
        });

        expect(mockFormatLyrics).not.toHaveBeenCalled();
        expect(mockOnJobCreated).toHaveBeenCalledWith('job-unedited-1');
    });

    it('edited lyrics trigger auto-formatting on submission with temporary button state and submits formatted output', async () => {
        mockGenerateLyrics.mockResolvedValueOnce({
            lyrics: '[Verse 1]\nOriginal lyrics',
        });
        let resolveFormat!: (val: { lyrics: string }) => void;
        const formatPromise = new Promise<{ lyrics: string }>((resolve) => {
            resolveFormat = resolve;
        });
        mockFormatLyrics.mockReturnValueOnce(formatPromise);
        mockApiFetch.mockResolvedValueOnce({ task_id: 'job-formatted-2' });

        advanceToStep3WithLyrics('An edited song');

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue(
                '[Verse 1]\nOriginal lyrics'
            );
        });

        // Edit lyrics
        const textarea = screen.getByRole('textbox', { name: /lyrics/i });
        fireEvent.change(textarea, {
            target: { value: 'my raw edited words without headers' },
        });

        const generateBtn = screen.getByRole('button', { name: /Generate Song/i });
        fireEvent.click(generateBtn);

        // Button should show "Formatting lyrics..."
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Formatting lyrics\.\.\./i })).toBeInTheDocument();
        });
        expect(mockFormatLyrics).toHaveBeenCalledWith('my raw edited words without headers');

        // Resolve formatting
        resolveFormat({ lyrics: '[Verse 1]\nmy raw edited words without headers\n\n[Chorus]\nFormatted refrain' });

        await waitFor(() => {
            expect(mockApiFetch).toHaveBeenCalledWith('/api/generate', expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('[Verse 1]\\nmy raw edited words without headers\\n\\n[Chorus]\\nFormatted refrain'),
            }));
        });
        expect(mockOnJobCreated).toHaveBeenCalledWith('job-formatted-2');
    });

    it('gracefully falls back to submitting raw edited lyrics if formatting fails or times out', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockGenerateLyrics.mockResolvedValueOnce({
            lyrics: '[Verse 1]\nOriginal lyrics',
        });
        mockFormatLyrics.mockRejectedValueOnce(new Error('Groq formatting timed out'));
        mockApiFetch.mockResolvedValueOnce({ task_id: 'job-fallback-3' });

        advanceToStep3WithLyrics('A fallback song');

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue(
                '[Verse 1]\nOriginal lyrics'
            );
        });

        // Edit lyrics
        const textarea = screen.getByRole('textbox', { name: /lyrics/i });
        fireEvent.change(textarea, {
            target: { value: 'custom raw lyrics that should be preserved verbatim' },
        });

        const generateBtn = screen.getByRole('button', { name: /Generate Song/i });
        fireEvent.click(generateBtn);

        await waitFor(() => {
            expect(mockFormatLyrics).toHaveBeenCalledWith('custom raw lyrics that should be preserved verbatim');
        });

        // Generation should not be blocked and raw text submitted
        await waitFor(() => {
            expect(mockApiFetch).toHaveBeenCalledWith('/api/generate', expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('custom raw lyrics that should be preserved verbatim'),
            }));
        });

        expect(mockOnJobCreated).toHaveBeenCalledWith('job-fallback-3');
        consoleWarnSpy.mockRestore();
    });

    it('restoring lyrics to the pristine Groq output skips formatting', async () => {
        mockGenerateLyrics.mockResolvedValueOnce({
            lyrics: '[Verse 1]\nOriginal pristine lyrics',
        });
        mockApiFetch.mockResolvedValueOnce({ task_id: 'job-restored-5' });

        advanceToStep3WithLyrics('A restored song');

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue(
                '[Verse 1]\nOriginal pristine lyrics'
            );
        });

        const textarea = screen.getByRole('textbox', { name: /lyrics/i });
        fireEvent.change(textarea, { target: { value: 'something else entirely' } });
        fireEvent.change(textarea, { target: { value: '[Verse 1]\nOriginal pristine lyrics' } });

        fireEvent.click(screen.getByRole('button', { name: /Generate Song/i }));

        await waitFor(() => {
            expect(mockApiFetch).toHaveBeenCalledWith('/api/generate', expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('[Verse 1]\\nOriginal pristine lyrics'),
            }));
        });

        expect(mockFormatLyrics).not.toHaveBeenCalled();
        expect(mockOnJobCreated).toHaveBeenCalledWith('job-restored-5');
    });

    it('clearing edited lyrics submits as instrumental and skips formatting', async () => {
        mockGenerateLyrics.mockResolvedValueOnce({
            lyrics: '[Verse 1]\nOriginal lyrics',
        });
        mockApiFetch.mockResolvedValueOnce({ task_id: 'job-cleared-4' });

        advanceToStep3WithLyrics('Clear lyrics song');

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue(
                '[Verse 1]\nOriginal lyrics'
            );
        });

        // Clear lyrics completely
        const textarea = screen.getByRole('textbox', { name: /lyrics/i });
        fireEvent.change(textarea, { target: { value: '   ' } });

        const generateBtn = screen.getByRole('button', { name: /Generate Song/i });
        fireEvent.click(generateBtn);

        await waitFor(() => {
            expect(mockApiFetch).toHaveBeenCalledWith('/api/generate', expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('"lyrics":"[Instrumental]"'),
            }));
        });

        expect(mockFormatLyrics).not.toHaveBeenCalled();
        expect(mockOnJobCreated).toHaveBeenCalledWith('job-cleared-4');
    });
});


describe('MusicGeneratorWizard - Prompt Enhancement (#84)', () => {
    const mockOnJobCreated = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderStep1 = (promptText = 'Make a pop punk song about being a dad') => {
        render(<MusicGeneratorWizard onJobCreated={mockOnJobCreated} />);
        fireEvent.change(screen.getByRole('textbox', { name: /prompt/i }), {
            target: { value: promptText },
        });
    };

    const promptBox = () => screen.getByRole('textbox', { name: /prompt/i });
    const enhanceButton = () => screen.getByRole('button', { name: /Enhance Prompt/i });

    it('Enhance Prompt replaces the prompt text in place and shows the attempts left', async () => {
        mockEnhancePrompt.mockResolvedValue({ prompt: 'Pop punk, 180 BPM, distorted power chords' });
        renderStep1();

        fireEvent.click(enhanceButton());

        await waitFor(() => {
            expect(promptBox()).toHaveValue('Pop punk, 180 BPM, distorted power chords');
        });
        expect(mockEnhancePrompt).toHaveBeenCalledWith(
            'Make a pop punk song about being a dad',
            1,
            undefined
        );
        expect(screen.getByText(/2 left/i)).toBeInTheDocument();
        // Still on Step 1: enhancing edits the prompt, it does not advance the wizard.
        expect(screen.getByText(/Step 1 of 3/i)).toBeInTheDocument();
    });

    it('Revert to Original restores the typed prompt without spending an attempt', async () => {
        mockEnhancePrompt.mockResolvedValue({ prompt: 'Pop punk, 180 BPM, distorted power chords' });
        renderStep1();
        expect(screen.queryByRole('button', { name: /Revert to Original/i })).not.toBeInTheDocument();

        fireEvent.click(enhanceButton());
        await waitFor(() => expect(promptBox()).toHaveValue('Pop punk, 180 BPM, distorted power chords'));

        fireEvent.click(screen.getByRole('button', { name: /Revert to Original/i }));

        expect(promptBox()).toHaveValue('Make a pop punk song about being a dad');
        expect(mockEnhancePrompt).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/2 left/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Revert to Original/i })).not.toBeInTheDocument();
    });

    it('repeat enhancements vary the original prompt and stop after three attempts', async () => {
        mockEnhancePrompt
            .mockResolvedValueOnce({ prompt: 'Take one' })
            .mockResolvedValueOnce({ prompt: 'Take two' })
            .mockResolvedValueOnce({ prompt: 'Take three' });
        renderStep1('lofi beats');
        expect(screen.getByText(/3 left/i)).toBeInTheDocument();

        for (const expected of ['Take one', 'Take two', 'Take three']) {
            fireEvent.click(enhanceButton());
            await waitFor(() => expect(promptBox()).toHaveValue(expected));
        }

        // Each call carries the attempt number and the text the visitor originally typed.
        expect(mockEnhancePrompt.mock.calls).toEqual([
            ['lofi beats', 1, undefined],
            ['Take one', 2, 'lofi beats'],
            ['Take two', 3, 'lofi beats'],
        ]);
        expect(screen.getByText(/0 left/i)).toBeInTheDocument();
        expect(enhanceButton()).toBeDisabled();
    });

    it('keeps the attempt counter, enhanced text and Revert when navigating Back and forth', async () => {
        mockEnhancePrompt.mockResolvedValue({ prompt: 'Pop punk, 180 BPM, distorted power chords' });
        renderStep1();
        fireEvent.click(enhanceButton());
        await waitFor(() => expect(promptBox()).toHaveValue('Pop punk, 180 BPM, distorted power chords'));

        fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
        expect(screen.getByText(/Step 2 of 3/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Back/i }));

        expect(promptBox()).toHaveValue('Pop punk, 180 BPM, distorted power chords');
        expect(screen.getByText(/2 left/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Revert to Original/i })).toBeInTheDocument();
        expect(mockEnhancePrompt).toHaveBeenCalledTimes(1);
    });

    it('disables Enhance with an explanatory tooltip when the AI service is not configured', async () => {
        mockEnhancePrompt.mockRejectedValue(
            new ApiError(503, 'Service Unavailable', { detail: 'AI lyric service is not configured' })
        );
        renderStep1();

        fireEvent.click(enhanceButton());

        await waitFor(() => expect(enhanceButton()).toBeDisabled());
        expect(enhanceButton()).toHaveAttribute('title', expect.stringMatching(/unavailable/i));
        // The failed call is not billed as an attempt, and the wizard carries on regardless.
        expect(promptBox()).toHaveValue('Make a pop punk song about being a dad');
        expect(screen.getByText(/3 left/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
        expect(screen.getByText(/Step 2 of 3/i)).toBeInTheDocument();
    });

    it('reports a transient enhancement failure without spending an attempt', async () => {
        mockEnhancePrompt.mockRejectedValue(new Error('Network error'));
        renderStep1();

        fireEvent.click(enhanceButton());

        expect(await screen.findByRole('alert')).toHaveTextContent(/enhance/i);
        expect(promptBox()).toHaveValue('Make a pop punk song about being a dad');
        expect(screen.getByText(/3 left/i)).toBeInTheDocument();
        expect(enhanceButton()).toBeEnabled();
    });
});

describe('MusicGeneratorWizard - Contrastive Lyric Regeneration (#86)', () => {
    const mockOnJobCreated = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const enterPromptAndContinue = (promptText: string) => {
        fireEvent.change(screen.getByRole('textbox', { name: /prompt/i }), {
            target: { value: promptText },
        });
        fireEvent.click(screen.getByRole('button', { name: /Next|Continue/i }));
    };

    const advanceToLyricsStep = async (promptText = 'A synthwave journey') => {
        render(<MusicGeneratorWizard onJobCreated={mockOnJobCreated} />);
        enterPromptAndContinue(promptText);
        fireEvent.click(screen.getByRole('button', { name: /Song with Lyrics/i }));
        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /lyrics/i })).toBeInTheDocument();
        });
    };

    const regenerateButton = () => screen.getByRole('button', { name: /Regenerate Lyrics/i });

    it('Regenerate Lyrics replaces the lyrics with a new take contrasted against the previous one', async () => {
        mockGenerateLyrics
            .mockResolvedValueOnce({ lyrics: '[Verse 1]\nFirst take' })
            .mockResolvedValueOnce({ lyrics: '[Verse 1]\nSecond take' });

        await advanceToLyricsStep('A synthwave journey');
        expect(regenerateButton()).toHaveTextContent(/3 left/i);

        fireEvent.click(regenerateButton());

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue(
                '[Verse 1]\nSecond take'
            );
        });
        expect(mockGenerateLyrics).toHaveBeenLastCalledWith(
            'A synthwave journey',
            '[Verse 1]\nFirst take'
        );
        expect(regenerateButton()).toHaveTextContent(/2 left/i);
    });

    it('caps regeneration at 3 attempts and then disables the button', async () => {
        mockGenerateLyrics.mockImplementation(async () => ({ lyrics: '[Verse 1]\nA take' }));

        await advanceToLyricsStep();

        for (const expectedLeft of [3, 2, 1]) {
            expect(regenerateButton()).toHaveTextContent(new RegExp(`${expectedLeft} left`, 'i'));
            fireEvent.click(regenerateButton());
            await waitFor(() =>
                expect(regenerateButton()).toHaveTextContent(new RegExp(`${expectedLeft - 1} left`, 'i'))
            );
        }

        expect(regenerateButton()).toHaveTextContent(/0 left/i);
        expect(regenerateButton()).toBeDisabled();
        // 1 automatic take + 3 regenerations
        expect(mockGenerateLyrics).toHaveBeenCalledTimes(4);
    });

    it('resets the regeneration allowance to 3 when the prompt changes in Step 1', async () => {
        mockGenerateLyrics.mockImplementation(async () => ({ lyrics: '[Verse 1]\nA take' }));

        await advanceToLyricsStep('A synthwave journey');
        fireEvent.click(regenerateButton());
        await waitFor(() => expect(regenerateButton()).toHaveTextContent(/2 left/i));

        // Back to Step 1 and reword the prompt
        fireEvent.click(screen.getByRole('button', { name: /Back/i }));
        fireEvent.click(screen.getByRole('button', { name: /Back/i }));
        enterPromptAndContinue('A synthwave journey through a rainy city');
        fireEvent.click(screen.getByRole('button', { name: /Song with Lyrics/i }));

        await waitFor(() => {
            expect(regenerateButton()).toHaveTextContent(/3 left/i);
        });
    });

    it('keeps the remaining allowance when the prompt is left unchanged', async () => {
        mockGenerateLyrics.mockImplementation(async () => ({ lyrics: '[Verse 1]\nA take' }));

        await advanceToLyricsStep('A synthwave journey');
        fireEvent.click(regenerateButton());
        await waitFor(() => expect(regenerateButton()).toHaveTextContent(/2 left/i));

        fireEvent.click(screen.getByRole('button', { name: /Back/i }));
        fireEvent.click(screen.getByRole('button', { name: /Back/i }));
        fireEvent.click(screen.getByRole('button', { name: /Next|Continue/i }));
        fireEvent.click(screen.getByRole('button', { name: /Song with Lyrics/i }));

        expect(regenerateButton()).toHaveTextContent(/2 left/i);
    });

    describe('protecting manual edits', () => {
        const editLyrics = (text: string) =>
            fireEvent.change(screen.getByRole('textbox', { name: /lyrics/i }), {
                target: { value: text },
            });

        it('asks for confirmation before regenerating over edited lyrics and keeps the edits if declined', async () => {
            mockGenerateLyrics.mockResolvedValueOnce({ lyrics: '[Verse 1]\nFirst take' });

            await advanceToLyricsStep();
            editLyrics('[Verse 1]\nMy own words');
            fireEvent.click(regenerateButton());

            expect(screen.getByText(/discard your edits/i)).toBeInTheDocument();
            expect(mockGenerateLyrics).toHaveBeenCalledTimes(1);

            fireEvent.click(screen.getByRole('button', { name: /Keep my edits/i }));

            expect(screen.queryByText(/discard your edits/i)).not.toBeInTheDocument();
            expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue('[Verse 1]\nMy own words');
            expect(mockGenerateLyrics).toHaveBeenCalledTimes(1);
            expect(regenerateButton()).toHaveTextContent(/3 left/i);
        });

        it('regenerates against the last AI take once the visitor confirms discarding their edits', async () => {
            mockGenerateLyrics
                .mockResolvedValueOnce({ lyrics: '[Verse 1]\nFirst take' })
                .mockResolvedValueOnce({ lyrics: '[Verse 1]\nSecond take' });

            await advanceToLyricsStep();
            editLyrics('[Verse 1]\nMy own words');
            fireEvent.click(regenerateButton());
            fireEvent.click(screen.getByRole('button', { name: /Discard edits & regenerate/i }));

            await waitFor(() => {
                expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue('[Verse 1]\nSecond take');
            });
            expect(mockGenerateLyrics).toHaveBeenLastCalledWith('A synthwave journey', '[Verse 1]\nFirst take');
            expect(screen.queryByText(/discard your edits/i)).not.toBeInTheDocument();
        });

        it('regenerates immediately when the lyrics are untouched', async () => {
            mockGenerateLyrics
                .mockResolvedValueOnce({ lyrics: '[Verse 1]\nFirst take' })
                .mockResolvedValueOnce({ lyrics: '[Verse 1]\nSecond take' });

            await advanceToLyricsStep();
            fireEvent.click(regenerateButton());

            expect(screen.queryByText(/discard your edits/i)).not.toBeInTheDocument();
            await waitFor(() => expect(mockGenerateLyrics).toHaveBeenCalledTimes(2));
        });
    });

    describe('with an example prompt', () => {
        const example = {
            prompt: 'An upbeat indie track with sparkling guitars',
            lyrics: '[Verse 1]\nWalking down the sunny street',
            vocal_language: 'en',
            instrumental: false,
        };

        const loadExampleAndOpenLyrics = async () => {
            mockGetRandomExample.mockResolvedValue(example);
            render(<MusicGeneratorWizard onJobCreated={mockOnJobCreated} />);
            fireEvent.click(screen.getByRole('button', { name: /Try an Example/i }));
            await waitFor(() => {
                expect(screen.getByRole('textbox', { name: /prompt/i })).toHaveValue(example.prompt);
            });
            fireEvent.click(screen.getByRole('button', { name: /Next|Continue/i }));
            fireEvent.click(screen.getByRole('button', { name: /Song with Lyrics/i }));
        };

        it('regenerates from the example lyrics and keeps the new take after navigating back and forth', async () => {
            mockGenerateLyrics.mockResolvedValueOnce({ lyrics: '[Verse 1]\nRegenerated take' });

            await loadExampleAndOpenLyrics();
            expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue(example.lyrics);

            fireEvent.click(regenerateButton());
            await waitFor(() => {
                expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue('[Verse 1]\nRegenerated take');
            });
            expect(mockGenerateLyrics).toHaveBeenCalledWith(example.prompt, example.lyrics);

            fireEvent.click(screen.getByRole('button', { name: /Back/i }));
            fireEvent.click(screen.getByRole('button', { name: /Back/i }));
            fireEvent.click(screen.getByRole('button', { name: /Next|Continue/i }));
            fireEvent.click(screen.getByRole('button', { name: /Song with Lyrics/i }));

            expect(screen.getByRole('textbox', { name: /lyrics/i })).toHaveValue('[Verse 1]\nRegenerated take');
            expect(regenerateButton()).toHaveTextContent(/2 left/i);
        });

        it('loading a new example resets the regeneration allowance', async () => {
            mockGenerateLyrics.mockResolvedValue({ lyrics: '[Verse 1]\nA take' });

            await advanceToLyricsStep('A synthwave journey');
            fireEvent.click(regenerateButton());
            await waitFor(() => expect(regenerateButton()).toHaveTextContent(/2 left/i));

            fireEvent.click(screen.getByRole('button', { name: /Back/i }));
            fireEvent.click(screen.getByRole('button', { name: /Back/i }));
            mockGetRandomExample.mockResolvedValue(example);
            fireEvent.click(screen.getByRole('button', { name: /Try an Example/i }));
            await waitFor(() => {
                expect(screen.getByRole('textbox', { name: /prompt/i })).toHaveValue(example.prompt);
            });
            fireEvent.click(screen.getByRole('button', { name: /Next|Continue/i }));
            fireEvent.click(screen.getByRole('button', { name: /Song with Lyrics/i }));

            expect(regenerateButton()).toHaveTextContent(/3 left/i);
        });
    });
});

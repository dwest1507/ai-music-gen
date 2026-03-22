import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { MusicGeneratorForm } from '@/components/MusicGeneratorForm';
import { apiFetch, getRandomExample } from '@/lib/api';
import React from 'react';

// Mock dependencies
vi.mock('@/lib/api', () => ({
    apiFetch: vi.fn(),
    getRandomExample: vi.fn(),
}));

const mockApiFetch = apiFetch as MockedFunction<typeof apiFetch>;
const mockGetRandomExample = getRandomExample as MockedFunction<typeof getRandomExample>;

// Mock UI components
vi.mock('@/components/ui/input', () => ({
    Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
}));

vi.mock('@/components/ui/select', () => ({
    Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
    Button: (props: React.ComponentProps<'button'>) => <button {...props}>{props.children}</button>,
}));

vi.mock('@/components/ui/card', () => ({
    Card: ({ children, className }: React.ComponentProps<'div'>) => <div className={className}>{children}</div>,
    CardHeader: ({ children }: React.ComponentProps<'div'>) => <div>{children}</div>,
    CardTitle: ({ children }: React.ComponentProps<'div'>) => <h1>{children}</h1>,
    CardDescription: ({ children }: React.ComponentProps<'div'>) => <p>{children}</p>,
    CardContent: ({ children }: React.ComponentProps<'div'>) => <div>{children}</div>,
}));

// Mock icons — include all icons used by the component
vi.mock('lucide-react', () => ({
    Music: () => <svg data-testid="music-icon" />,
    Settings2: () => <svg data-testid="settings-icon" />,
    Sparkles: () => <svg data-testid="sparkles-icon" />,
    SlidersHorizontal: () => <svg data-testid="sliders-icon" />,
    HelpCircle: () => <svg data-testid="help-icon" />,
}));

describe('MusicGeneratorForm', () => {
    const mockOnJobCreated = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly in simple mode', () => {
        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        expect(screen.getByText('Create Music')).toBeInTheDocument();
        // Prompt is a textarea; label text is "Prompt *"
        expect(screen.getByRole('textbox', { name: /Prompt/i })).toBeInTheDocument();
        // Duration is split into two inputs with aria-labels
        expect(screen.getByLabelText(/Minutes/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Seconds/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Generate Music/i })).toBeInTheDocument();

        // Advanced fields should not be visible
        expect(screen.queryByRole('textbox', { name: /Lyrics/i })).not.toBeInTheDocument();
    });

    it('shows required footnote', () => {
        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);
        expect(screen.getByText(/Required/i)).toBeInTheDocument();
    });

    it('toggles advanced mode and shows advanced fields', () => {
        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        const advancedButton = screen.getByRole('button', { name: /Advanced/i });
        fireEvent.click(advancedButton);

        // Advanced fields should now be visible
        expect(screen.getByRole('textbox', { name: /Lyrics/i })).toBeInTheDocument();
        expect(screen.getByRole('spinbutton', { name: /BPM/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/Time Sig/i)).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /Instrumental only/i })).toBeInTheDocument();

        // The toggle button should say Simple Mode
        expect(screen.getByRole('button', { name: /Simple Mode/i })).toBeInTheDocument();
    });

    it('displays validation error for short prompt', async () => {
        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        const promptInput = screen.getByRole('textbox', { name: /Prompt/i });
        fireEvent.change(promptInput, { target: { value: 'Hi' } }); // Too short

        const submitButton = screen.getByRole('button', { name: /Generate Music/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/Prompt must be at least 3 characters/i)).toBeInTheDocument();
        });

        expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('submits form successfully in simple mode', async () => {
        mockApiFetch.mockResolvedValue({
            task_id: 'test-job-123',
            status: 'queued',
        });

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        fireEvent.change(screen.getByRole('textbox', { name: /Prompt/i }), { target: { value: 'A cool jazz track' } });
        // Set duration to 0m 30s = 30 seconds
        fireEvent.change(screen.getByLabelText(/Minutes/i), { target: { value: '0' } });
        fireEvent.change(screen.getByLabelText(/Seconds/i), { target: { value: '30' } });

        fireEvent.click(screen.getByRole('button', { name: /Generate Music/i }));

        await waitFor(() => {
            expect(mockApiFetch).toHaveBeenCalledWith('/api/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'A cool jazz track',
                    duration: 30,
                    vocal_language: 'en',
                    audio_format: 'mp3',
                    thinking: true,
                    use_format: false,
                    inference_steps: 8,
                    batch_size: 1,
                    infer_method: 'ode',
                }),
            });
        });

        await waitFor(() => {
            expect(mockOnJobCreated).toHaveBeenCalledWith('test-job-123');
        });
    });

    it('submits form successfully with advanced fields', async () => {
        mockApiFetch.mockResolvedValue({
            task_id: 'test-job-123',
            status: 'queued',
        });

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        // Turn on advanced
        fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));

        fireEvent.change(screen.getByRole('textbox', { name: /Prompt/i }), { target: { value: 'An advanced jazz track' } });
        // Set duration to 2m 0s = 120 seconds
        fireEvent.change(screen.getByLabelText(/Minutes/i), { target: { value: '2' } });
        fireEvent.change(screen.getByLabelText(/Seconds/i), { target: { value: '0' } });
        fireEvent.change(screen.getByRole('textbox', { name: /Lyrics/i }), { target: { value: 'Testing lyrics' } });
        fireEvent.change(screen.getByRole('spinbutton', { name: /BPM/i }), { target: { value: '120' } });

        fireEvent.click(screen.getByRole('button', { name: /Generate Music/i }));

        await waitFor(() => {
            expect(mockApiFetch).toHaveBeenCalledWith('/api/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'An advanced jazz track',
                    duration: 120,
                    lyrics: 'Testing lyrics',
                    vocal_language: 'en',
                    audio_format: 'mp3',
                    thinking: true,
                    use_format: false,
                    bpm: 120,
                    inference_steps: 8,
                    batch_size: 1,
                    infer_method: 'ode',
                }),
            });
        });

        await waitFor(() => {
            expect(mockOnJobCreated).toHaveBeenCalledWith('test-job-123');
        });
    });

    it('does not send lyrics when user input has 5 or fewer non-whitespace chars', async () => {
        mockApiFetch.mockResolvedValue({ task_id: 'auto-lyrics-task', status: 'queued' });

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);
        fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));

        fireEvent.change(screen.getByRole('textbox', { name: /Prompt/i }), { target: { value: 'A lo-fi track' } });
        // 5 non-whitespace chars exactly — should NOT be sent
        fireEvent.change(screen.getByRole('textbox', { name: /Lyrics/i }), { target: { value: 'hello' } });

        fireEvent.click(screen.getByRole('button', { name: /Generate Music/i }));

        await waitFor(() => {
            const body = JSON.parse((mockApiFetch.mock.calls[0][1] as { body: string }).body);
            expect(body.lyrics).toBeUndefined();
        });
    });

    it('sends lyrics when user input has more than 5 non-whitespace chars', async () => {
        mockApiFetch.mockResolvedValue({ task_id: 'user-lyrics-task', status: 'queued' });

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);
        fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));

        fireEvent.change(screen.getByRole('textbox', { name: /Prompt/i }), { target: { value: 'A pop song' } });
        // 6 non-whitespace chars — should be sent
        fireEvent.change(screen.getByRole('textbox', { name: /Lyrics/i }), { target: { value: 'hello!' } });

        fireEvent.click(screen.getByRole('button', { name: /Generate Music/i }));

        await waitFor(() => {
            const body = JSON.parse((mockApiFetch.mock.calls[0][1] as { body: string }).body);
            expect(body.lyrics).toBe('hello!');
        });
    });

    it('sends instrumental flag and omits lyrics when instrumental checkbox is checked', async () => {
        mockApiFetch.mockResolvedValue({ task_id: 'inst-task', status: 'queued' });

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);
        fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));

        fireEvent.change(screen.getByRole('textbox', { name: /Prompt/i }), { target: { value: 'A piano piece' } });
        fireEvent.change(screen.getByRole('textbox', { name: /Lyrics/i }), { target: { value: 'some lyrics here that are long' } });
        fireEvent.click(screen.getByRole('checkbox', { name: /Instrumental only/i }));

        fireEvent.click(screen.getByRole('button', { name: /Generate Music/i }));

        await waitFor(() => {
            const body = JSON.parse((mockApiFetch.mock.calls[0][1] as { body: string }).body);
            expect(body.instrumental).toBe(true);
            expect(body.lyrics).toBeUndefined();
        });
    });

    it('disables lyrics textarea when instrumental checkbox is checked', () => {
        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);
        fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));

        const lyricsTextarea = screen.getByRole('textbox', { name: /Lyrics/i });
        expect(lyricsTextarea).not.toBeDisabled();

        fireEvent.click(screen.getByRole('checkbox', { name: /Instrumental only/i }));
        expect(lyricsTextarea).toBeDisabled();
    });

    it('handles API errors', async () => {
        mockApiFetch.mockRejectedValue(new Error('API Error'));

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        fireEvent.change(screen.getByRole('textbox', { name: /Prompt/i }), { target: { value: 'Valid prompt' } });
        fireEvent.click(screen.getByRole('button', { name: /Generate Music/i }));

        await waitFor(() => {
            expect(screen.getByText(/API Error/i)).toBeInTheDocument();
        });

        expect(mockOnJobCreated).not.toHaveBeenCalled();
    });

    it('shows error when "Try an Example" API call fails', async () => {
        mockGetRandomExample.mockRejectedValue(new Error('Network error'));

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        fireEvent.click(screen.getByRole('button', { name: /Try an Example/i }));

        await waitFor(() => {
            expect(screen.getByText(/Failed to fetch example/i)).toBeInTheDocument();
        });
    });

    it('enforces 5-second cooldown between submissions', async () => {
        mockApiFetch.mockResolvedValue({ task_id: 'job-1', status: 'queued' });

        const now = Date.now();
        vi.spyOn(Date, 'now')
            .mockReturnValueOnce(now)         // first submit records time
            .mockReturnValueOnce(now + 1000); // second submit within 5 seconds

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        const promptInput = screen.getByRole('textbox', { name: /Prompt/i });
        fireEvent.change(promptInput, { target: { value: 'A cool track' } });
        fireEvent.click(screen.getByRole('button', { name: /Generate Music/i }));

        await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1));

        // Second submit within cooldown window
        fireEvent.click(screen.getByRole('button', { name: /Generate Music/i }));

        await waitFor(() => {
            expect(screen.getByText(/Please wait a few seconds/i)).toBeInTheDocument();
        });

        vi.restoreAllMocks();
    });

    it('populates form when "Try an Example" is clicked', async () => {
        // 1. Test Simple Mode -> Simple Example
        const simpleExample = {
            is_advanced: false,
            prompt: 'Simple Prompt',
            lyrics: '',
            vocal_language: 'en',
            duration: 30, // 0m 30s
            thinking: true,
        };
        mockGetRandomExample.mockResolvedValueOnce(simpleExample);

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        const tryExampleButton = screen.getByRole('button', { name: /Try an Example/i });
        fireEvent.click(tryExampleButton);

        await waitFor(() => {
            expect(mockGetRandomExample).toHaveBeenCalledWith(false);
            expect(screen.getByDisplayValue('Simple Prompt')).toBeInTheDocument();
            // duration 30s → 0m 30s
            expect(screen.getByLabelText(/Minutes/i)).toHaveValue(0);
            expect(screen.getByLabelText(/Seconds/i)).toHaveValue(30);
        });

        // 2. Test Advanced Mode -> Advanced Example
        const advancedExample = {
            is_advanced: true,
            prompt: 'Advanced Prompt',
            lyrics: 'Advanced Lyrics',
            vocal_language: 'ja',
            bpm: 140,
            duration: 120, // 2m 0s
            thinking: true,
        };
        mockGetRandomExample.mockResolvedValueOnce(advancedExample);

        // Switch to advanced mode manually
        fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));

        fireEvent.click(tryExampleButton);

        await waitFor(() => {
            expect(mockGetRandomExample).toHaveBeenLastCalledWith(true);
            expect(screen.getByDisplayValue('Advanced Prompt')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Advanced Lyrics')).toBeInTheDocument();
            expect(screen.getByDisplayValue('140')).toBeInTheDocument();
            // duration 120s → 2m 0s
            expect(screen.getByLabelText(/Minutes/i)).toHaveValue(2);
            expect(screen.getByLabelText(/Seconds/i)).toHaveValue(0);
        });
    });
});

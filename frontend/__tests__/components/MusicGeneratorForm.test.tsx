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
    Sparkles: () => <svg data-testid="sparkles-icon" />,
    HelpCircle: () => <svg data-testid="help-icon" />,
}));

describe('MusicGeneratorForm', () => {
    const mockOnJobCreated = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders all fields correctly', () => {
        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        expect(screen.getByText('Create Music')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /Prompt/i })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /Lyrics/i })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /Instrumental only/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Generate Music/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Try an Example/i })).toBeInTheDocument();
    });

    it('does not show advanced mode toggle', () => {
        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        expect(screen.queryByRole('button', { name: /Advanced/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Simple Mode/i })).not.toBeInTheDocument();
    });

    it('shows required footnote', () => {
        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);
        expect(screen.getByText(/Required/i)).toBeInTheDocument();
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

    it('submits form successfully with only prompt', async () => {
        mockApiFetch.mockResolvedValue({
            task_id: 'test-job-123',
            status: 'queued',
        });

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        fireEvent.change(screen.getByRole('textbox', { name: /Prompt/i }), { target: { value: 'A cool jazz track' } });

        fireEvent.click(screen.getByRole('button', { name: /Generate Music/i }));

        await waitFor(() => {
            expect(mockApiFetch).toHaveBeenCalledWith('/api/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'A cool jazz track',
                    vocal_language: 'en',
                }),
            });
        });

        await waitFor(() => {
            expect(mockOnJobCreated).toHaveBeenCalledWith('test-job-123');
        });
    });

    it('submits form with genre and lyrics', async () => {
        mockApiFetch.mockResolvedValue({
            task_id: 'test-job-456',
            status: 'queued',
        });

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        fireEvent.change(screen.getByRole('textbox', { name: /Prompt/i }), { target: { value: 'An upbeat pop song' } });
        fireEvent.change(screen.getByRole('textbox', { name: /Lyrics/i }), { target: { value: 'Hello world, this is a song' } });

        fireEvent.click(screen.getByRole('button', { name: /Generate Music/i }));

        await waitFor(() => {
            const body = JSON.parse((mockApiFetch.mock.calls[0][1] as { body: string }).body);
            expect(body.prompt).toBe('An upbeat pop song');
            expect(body.lyrics).toBe('Hello world, this is a song');
        });
    });

    it('does not send lyrics when user input has 5 or fewer non-whitespace chars', async () => {
        mockApiFetch.mockResolvedValue({ task_id: 'auto-lyrics-task', status: 'queued' });

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

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
        const exampleData = {
            prompt: 'Example Prompt',
            lyrics: 'Example Lyrics',
            vocal_language: 'ja',
            genre: 'Jazz',
            instrumental: false,
        };
        mockGetRandomExample.mockResolvedValueOnce(exampleData);

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        fireEvent.click(screen.getByRole('button', { name: /Try an Example/i }));

        await waitFor(() => {
            expect(mockGetRandomExample).toHaveBeenCalled();
            expect(screen.getByDisplayValue('Example Prompt')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Example Lyrics')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Jazz')).toBeInTheDocument();
        });
    });
});

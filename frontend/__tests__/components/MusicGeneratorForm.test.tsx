import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { MusicGeneratorForm } from '@/components/MusicGeneratorForm';
import { apiFetch } from '@/lib/api';
import React from 'react';

// Mock dependencies
vi.mock('@/lib/api', () => ({
    apiFetch: vi.fn(),
}));

const mockApiFetch = apiFetch as MockedFunction<typeof apiFetch>;

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

// Mock icons
vi.mock('lucide-react', () => ({
    Music: () => <svg data-testid="music-icon" />,
    Settings2: () => <svg data-testid="settings-icon" />,
    Sparkles: () => <svg data-testid="sparkles-icon" />,
}));

describe('MusicGeneratorForm', () => {
    const mockOnJobCreated = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly in simple mode', () => {
        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        expect(screen.getByText('Create Music')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /^Prompt$/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/Duration/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Generate Music/i })).toBeInTheDocument();

        // Advanced fields should not be visible
        expect(screen.queryByRole('textbox', { name: /Lyrics/i })).not.toBeInTheDocument();
    });

    it('toggles advanced mode and shows advanced fields', () => {
        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        const advancedButton = screen.getByRole('button', { name: /Advanced/i });
        fireEvent.click(advancedButton);

        // Advanced fields should now be visible
        expect(screen.getByRole('textbox', { name: /Lyrics/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/BPM/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Time Sig/i)).toBeInTheDocument();

        // The toggle button should say Simple Mode
        expect(screen.getByRole('button', { name: /Simple Mode/i })).toBeInTheDocument();
    });

    it('displays validation error for short prompt', async () => {
        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        const promptInput = screen.getByRole('textbox', { name: /^Prompt$/i });
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

        fireEvent.change(screen.getByRole('textbox', { name: /^Prompt$/i }), { target: { value: 'A cool jazz track' } });
        fireEvent.change(screen.getByLabelText(/Duration/i), { target: { value: '30' } });

        fireEvent.click(screen.getByRole('button', { name: /Generate Music/i }));

        await waitFor(() => {
            expect(mockApiFetch).toHaveBeenCalledWith('/api/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'A cool jazz track',
                    duration: 30, // Assuming duration was cast to Number automatically or manually
                    vocal_language: "en",
                    thinking: true,
                    use_format: false,
                    inference_steps: 8,
                    batch_size: 1,
                }), // Includes default values for state fields
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

        fireEvent.change(screen.getByRole('textbox', { name: /^Prompt$/i }), { target: { value: 'An advanced jazz track' } });
        fireEvent.change(screen.getByLabelText(/Duration/i), { target: { value: '120' } });
        fireEvent.change(screen.getByRole('textbox', { name: /Lyrics/i }), { target: { value: 'Testing lyrics' } });
        fireEvent.change(screen.getByLabelText(/BPM/i), { target: { value: '120' } });

        fireEvent.click(screen.getByRole('button', { name: /Generate Music/i }));

        await waitFor(() => {
            expect(mockApiFetch).toHaveBeenCalledWith('/api/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'An advanced jazz track',
                    duration: 120,
                    lyrics: 'Testing lyrics',
                    vocal_language: 'en',
                    thinking: true,
                    use_format: false,
                    bpm: 120,
                    inference_steps: 8,
                    batch_size: 1,
                }),
            });
        });

        await waitFor(() => {
            expect(mockOnJobCreated).toHaveBeenCalledWith('test-job-123');
        });
    });

    it('handles API errors', async () => {
        mockApiFetch.mockRejectedValue(new Error('API Error'));

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        fireEvent.change(screen.getByRole('textbox', { name: /^Prompt$/i }), { target: { value: 'Valid prompt' } });
        fireEvent.click(screen.getByRole('button', { name: /Generate Music/i }));

        await waitFor(() => {
            expect(screen.getByText(/API Error/i)).toBeInTheDocument();
        });

        expect(mockOnJobCreated).not.toHaveBeenCalled();
    });
});

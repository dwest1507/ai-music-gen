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

// Mock UI components to simplify testing structure
vi.mock('@/components/ui/input', () => ({
    Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
}));

vi.mock('@/components/ui/select', () => ({
    Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
    Button: (props: React.ComponentProps<'button'>) => <button {...props}>{props.children}</button>,
}));

// Mock Card components just as divs with typed props
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
}));

describe('MusicGeneratorForm', () => {
    const mockOnJobCreated = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly', () => {
        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        expect(screen.getByText('Create Music')).toBeInTheDocument();
        expect(screen.getByLabelText(/Prompt/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Duration/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Generate Music/i })).toBeInTheDocument();
    });

    it('displays validation error for short prompt', async () => {
        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        const promptInput = screen.getByLabelText(/Prompt/i);
        fireEvent.change(promptInput, { target: { value: 'Hi' } }); // Too short

        const submitButton = screen.getByRole('button', { name: /Generate Music/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/Prompt must be at least 3 characters/i)).toBeInTheDocument();
        });

        expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('submits form successfully', async () => {
        // Mock successful API response
        // We treat the mocked function as a Jest/Vitest mock, so we use mockResolvedValue
        mockApiFetch.mockResolvedValue({
            job_id: 'test-job-123',
            status: 'queued',
            estimated_wait: 30
        });

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        // Fill prompt
        fireEvent.change(screen.getByLabelText(/Prompt/i), { target: { value: 'A cool jazz track' } });

        // Select duration (default is 60, change to 30)
        fireEvent.change(screen.getByLabelText(/Duration/i), { target: { value: '30' } });

        // Submit
        fireEvent.click(screen.getByRole('button', { name: /Generate Music/i }));

        await waitFor(() => {
            // The first argument is type-checked against the implementation
            expect(mockApiFetch).toHaveBeenCalledWith('/api/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'A cool jazz track',
                    duration: 30,
                }),
            });
        });

        await waitFor(() => {
            expect(mockOnJobCreated).toHaveBeenCalledWith('test-job-123');
        });
    });

    it('handles API errors', async () => {
        // Mock API error
        mockApiFetch.mockRejectedValue(new Error('API Error'));

        render(<MusicGeneratorForm onJobCreated={mockOnJobCreated} />);

        fireEvent.change(screen.getByLabelText(/Prompt/i), { target: { value: 'Valid prompt' } });
        fireEvent.click(screen.getByRole('button', { name: /Generate Music/i }));

        await waitFor(() => {
            expect(screen.getByText(/API Error/i)).toBeInTheDocument();
        });

        expect(mockOnJobCreated).not.toHaveBeenCalled();
    });
});

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { JobStatus } from '@/components/JobStatus';
import { apiFetch } from '@/lib/api';
import React from 'react';

vi.mock('@/lib/api', () => ({
    apiFetch: vi.fn(),
}));

const mockApiFetch = apiFetch as MockedFunction<typeof apiFetch>;

vi.mock('@/components/AudioPlayer', () => ({
    AudioPlayer: ({ audioUrl }: { audioUrl: string }) => <div data-testid="audio-player">{audioUrl}</div>,
}));

vi.mock('lucide-react', () => ({
    Loader2: () => <svg data-testid="loader-icon" />,
    CheckCircle2: () => <svg data-testid="check-icon" />,
    XCircle: () => <svg data-testid="x-icon" />,
    AlertCircle: () => <svg data-testid="alert-icon" />,
    Clock: () => <svg data-testid="clock-icon" />,
    Activity: () => <svg data-testid="activity-icon" />,
    Hash: () => <svg data-testid="hash-icon" />,
    FileAudio: () => <svg data-testid="file-audio-icon" />,
    Music: () => <svg data-testid="music-icon" />,
}));

vi.mock('@/components/ui/card', () => ({
    Card: ({ children, className }: React.ComponentProps<'div'>) => <div className={className}>{children}</div>,
    CardHeader: ({ children }: React.ComponentProps<'div'>) => <div>{children}</div>,
    CardTitle: ({ children }: React.ComponentProps<'div'>) => <h1>{children}</h1>,
    CardDescription: ({ children }: React.ComponentProps<'div'>) => <p>{children}</p>,
    CardContent: ({ children }: React.ComponentProps<'div'>) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
    Badge: ({ children }: React.ComponentProps<'div'>) => <span>{children}</span>,
}));

describe('JobStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders initializing state before data loads', () => {
        // Will never resolve in this test
        mockApiFetch.mockImplementation(() => new Promise(() => {}));

        render(<JobStatus jobId="test-job-123" />);
        expect(screen.getByText('Initializing job...')).toBeInTheDocument();
    });

    it('polls and displays queued status', async () => {
        mockApiFetch.mockResolvedValue({
            task_id: 'test-job-123',
            status: 'queued',
        });

        render(<JobStatus jobId="test-job-123" />);

        await waitFor(() => {
            expect(screen.getByText('Waiting in Queue...')).toBeInTheDocument();
        });

        expect(mockApiFetch).toHaveBeenCalledTimes(1);
    });

    it('handles completed status and renders metadata and multiple audios', async () => {
        mockApiFetch.mockResolvedValue({
            task_id: 'test-job-123',
            status: 'completed',
            audio_urls: ['/url1.mp3', '/url2.mp3'],
            metadata: {
                prompt: 'Cool test track',
                duration: 60,
                bpm: 120,
                key_scale: 'C Major',
                time_signature: '4/4'
            }
        });

        render(<JobStatus jobId="test-job-123" />);

        await waitFor(() => {
            expect(screen.getByText('Generation Complete!')).toBeInTheDocument();
            expect(screen.getByText(/"Cool test track"/)).toBeInTheDocument();
            expect(screen.getByText(/120 BPM/)).toBeInTheDocument();
            expect(screen.getByText(/C Major/)).toBeInTheDocument();
        });

        const players = screen.getAllByTestId('audio-player');
        expect(players).toHaveLength(2);
        expect(players[0]).toHaveTextContent('/url1.mp3');
        expect(players[1]).toHaveTextContent('/url2.mp3');
    });

    it('handles failed status', async () => {
        mockApiFetch.mockResolvedValue({
            task_id: 'test-job-123',
            status: 'failed',
            error: 'Out of memory'
        });

        render(<JobStatus jobId="test-job-123" />);

        await waitFor(() => {
            expect(screen.getByText('Generation Failed')).toBeInTheDocument();
            expect(screen.getByText('Out of memory')).toBeInTheDocument();
        });
    });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioPlayer } from '@/components/AudioPlayer';
import React from 'react';

vi.mock('lucide-react', () => ({
    Play: () => <svg data-testid="play-icon" />,
    Pause: () => <svg data-testid="pause-icon" />,
    Download: () => <svg data-testid="download-icon" />,
    Volume2: () => <svg data-testid="volume2-icon" />,
    VolumeX: () => <svg data-testid="volumex-icon" />,
}));

const mockWavesurferObj = {
    on: vi.fn((event, cb) => {
        if (event === 'ready') {
            cb();
        }
    }),
    destroy: vi.fn(),
    playPause: vi.fn(),
    setMuted: vi.fn(),
};

vi.mock('wavesurfer.js', () => ({
    default: {
        create: vi.fn(() => mockWavesurferObj),
    },
}));

describe('AudioPlayer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders and initializes wavesurfer', () => {
        render(<AudioPlayer audioUrl="test.mp3" />);
        expect(screen.getByRole('button', { name: /Download/i })).toBeInTheDocument();
    });

    it('handles download correctly and infers extension from parameter', () => {
        render(<AudioPlayer audioUrl="https://api.example.com/audio/task123?index=0" />);

        const mockLink = {
            click: vi.fn(),
            href: '',
            download: '',
        } as unknown as HTMLAnchorElement;
        const spyCreateElement = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
        vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
        vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

        const downloadButton = screen.getByRole('button', { name: /Download/i });
        fireEvent.click(downloadButton);

        expect(spyCreateElement).toHaveBeenCalledWith('a');
        expect(mockLink.href).toBe('https://api.example.com/audio/task123?index=0');
        expect(mockLink.download).toBe('music_task123.mp3');
        expect(mockLink.click).toHaveBeenCalled();
    });

    it('handles download fallback to .wav', () => {
        render(<AudioPlayer audioUrl="/api/audio/123-456.wav" />);

        const mockLink = {
            click: vi.fn(),
            href: '',
            download: '',
        } as unknown as HTMLAnchorElement;
        vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
        vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
        vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

        const downloadButton = screen.getByRole('button', { name: /Download/i });
        fireEvent.click(downloadButton);

        // Given it doesn't have a path parameter, but has .wav in the string
        expect(mockLink.download).toContain('.wav');
    });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

// jsdom's Blob is not compatible with Node's undici Response — constructing a
// real Response here throws, the component swallows it, and objectUrl stays
// null, which makes these tests pass without exercising anything. A plain stub
// keeps the assertions honest.
const audioResponse = () => ({ ok: true, blob: async () => new Blob(['audio-bytes']) });

describe('AudioPlayer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // The player now pulls the song into memory before it can play or
        // download it, so every test needs the fetch to resolve.
        vi.stubGlobal('fetch', vi.fn(async () => audioResponse()));
        URL.createObjectURL = vi.fn(() => 'blob:generated-song');
        URL.revokeObjectURL = vi.fn();
    });

    /** Waits for the in-memory copy to arrive, after which controls enable. */
    const waitUntilReady = () =>
        waitFor(() => expect(screen.getAllByRole('button')[0]).not.toBeDisabled());

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('renders and initializes wavesurfer', () => {
        render(<AudioPlayer audioUrl="test.mp3" />);
        expect(screen.getByRole('button', { name: /Download/i })).toBeInTheDocument();
    });

    it('handles download correctly and infers extension from parameter', async () => {
        render(<AudioPlayer audioUrl="https://api.example.com/audio/task123?index=0" />);
        await waitUntilReady();

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
        // Points at the in-memory copy: the network URL 404s once the GPU
        // container scales to zero and takes the file with it.
        expect(mockLink.href).toBe('blob:generated-song');
        expect(mockLink.download).toBe('music_task123.mp3');
        expect(mockLink.click).toHaveBeenCalled();
    });

    it('calls playPause when play button is clicked', async () => {
        render(<AudioPlayer audioUrl="/api/audio/task-abc" />);
        await waitUntilReady();

        const playButton = screen.getAllByRole('button')[0];
        fireEvent.click(playButton);

        expect(mockWavesurferObj.playPause).toHaveBeenCalled();
    });

    it('calls setMuted when mute button is clicked', async () => {
        render(<AudioPlayer audioUrl="/api/audio/task-abc" />);
        await waitUntilReady();

        const muteButton = screen.getAllByRole('button')[1];
        fireEvent.click(muteButton);

        expect(mockWavesurferObj.setMuted).toHaveBeenCalledWith(true);
    });

    it('extracts filename from ?path= query parameter', async () => {
        render(<AudioPlayer audioUrl="https://api.example.com/v1/audio?path=output%2Ftrack.flac" />);
        await waitUntilReady();

        const mockLink = {
            click: vi.fn(),
            href: '',
            download: '',
        } as unknown as HTMLAnchorElement;
        vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
        vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
        vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

        fireEvent.click(screen.getByRole('button', { name: /Download/i }));

        expect(mockLink.download).toBe('track.flac');
    });

    it('handles download fallback to .wav', async () => {
        render(<AudioPlayer audioUrl="/api/audio/123-456.wav" />);
        await waitUntilReady();

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

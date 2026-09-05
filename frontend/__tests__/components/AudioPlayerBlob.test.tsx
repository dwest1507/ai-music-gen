import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioPlayer } from '@/components/AudioPlayer';
import React from 'react';

/**
 * The generated song lives on the GPU container's ephemeral disk, and the job
 * record lives in that container's memory. Once it scales to zero, both are gone
 * and /api/audio returns 404. Holding the audio in the browser makes Download
 * work for the life of the page — which is exactly as long as the task id
 * survives anyway, since it is React state with no persistence.
 *
 * Fetching once instead of twice also drops a redundant upstream round trip:
 * every /api/audio call re-queries the task just to resolve the file path.
 */

vi.mock('lucide-react', () => ({
    Play: () => <svg data-testid="play-icon" />,
    Pause: () => <svg data-testid="pause-icon" />,
    Download: () => <svg data-testid="download-icon" />,
    Volume2: () => <svg data-testid="volume2-icon" />,
    VolumeX: () => <svg data-testid="volumex-icon" />,
}));

const mockWavesurferObj = {
    on: vi.fn((event: string, cb: () => void) => {
        if (event === 'ready') cb();
    }),
    destroy: vi.fn(),
    playPause: vi.fn(),
    setMuted: vi.fn(),
};

vi.mock('wavesurfer.js', () => ({
    default: { create: vi.fn(() => mockWavesurferObj) },
}));

// jsdom's Blob is not compatible with Node's undici Response — constructing a
// real Response here throws, the component swallows it, and objectUrl stays
// null, which makes these tests pass without exercising anything. A plain stub
// keeps the assertions honest.
const audioResponse = () => ({ ok: true, blob: async () => new Blob(['audio-bytes']) });

describe('AudioPlayer audio retention', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', vi.fn(async () => audioResponse()));
        // Assigned rather than stubbed wholesale: spreading URL into a plain
        // object loses the constructor, which handleDownload uses to infer the
        // filename.
        URL.createObjectURL = vi.fn(() => 'blob:generated-song');
        URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('fetches the audio exactly once', async () => {
        render(<AudioPlayer audioUrl="/api/audio/abc123" />);

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    });

    it('downloads from memory without going back to the network', async () => {
        render(<AudioPlayer audioUrl="/api/audio/abc123" />);
        // Wait for the copy to actually land, not merely for the request to go
        // out — clicking before then hits the early return and asserts nothing.
        await waitFor(() =>
            expect(screen.getByRole('button', { name: /Download/i })).not.toBeDisabled()
        );

        const link = { click: vi.fn(), href: '', download: '' } as unknown as HTMLAnchorElement;
        vi.spyOn(document, 'createElement').mockReturnValue(link);
        vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
        vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

        fireEvent.click(screen.getByRole('button', { name: /Download/i }));

        // Still one. Previously playback and download each pulled the full file,
        // and each pull re-queried the task upstream to resolve its path.
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(link.href).toBe('blob:generated-song');
        expect(link.click).toHaveBeenCalled();
    });
});

describe('AudioPlayer load failures', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        URL.createObjectURL = vi.fn(() => 'blob:generated-song');
        URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    /**
     * Every one of these previously left objectUrl null with nothing rendered:
     * a dimmed waveform and three dead buttons, which reads as a broken page
     * rather than a track that is no longer there.
     */
    it('says the track is gone when the container has scaled down', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));

        render(<AudioPlayer audioUrl="/api/audio/abc123" />);

        expect(await screen.findByRole('alert')).toHaveTextContent(/no longer available/i);
    });

    it('says to wait when the audio endpoint refuses the request', async () => {
        // /api/audio allows 20/min, and the limiter keys on client IP, so a
        // shared network can reach it without this viewer doing anything odd.
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429 })));

        render(<AudioPlayer audioUrl="/api/audio/abc123" />);

        expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i);
    });

    it('reports a network failure rather than showing dead controls', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network down'); }));

        render(<AudioPlayer audioUrl="/api/audio/abc123" />);

        expect(await screen.findByRole('alert')).toBeInTheDocument();
    });
});

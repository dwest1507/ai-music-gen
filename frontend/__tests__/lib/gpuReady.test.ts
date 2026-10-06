import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitForGpuReady, GPU_READY_POLL_MS, GPU_READY_TIMEOUT_MS } from '@/lib/gpuReady';
import { apiFetch } from '@/lib/api';

vi.mock('@/lib/api', () => ({
    apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

describe('waitForGpuReady', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockApiFetch.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('resolves on the first probe when the GPU is already up', async () => {
        mockApiFetch.mockResolvedValue({ ready: true });

        await waitForGpuReady();

        expect(mockApiFetch).toHaveBeenCalledTimes(1);
        expect(mockApiFetch).toHaveBeenCalledWith('/api/gpu-ready');
    });

    it('keeps probing while the GPU wakes, says so once, and resolves when it answers', async () => {
        mockApiFetch
            .mockResolvedValueOnce({ ready: false })
            .mockResolvedValueOnce({ ready: false })
            .mockResolvedValueOnce({ ready: true });
        const onWaking = vi.fn();
        let resolved = false;

        const waiting = waitForGpuReady(onWaking).then(() => {
            resolved = true;
        });

        await vi.advanceTimersByTimeAsync(0);
        expect(onWaking).toHaveBeenCalledTimes(1);
        expect(resolved).toBe(false);

        await vi.advanceTimersByTimeAsync(GPU_READY_POLL_MS);
        expect(mockApiFetch).toHaveBeenCalledTimes(2);
        expect(resolved).toBe(false);

        await vi.advanceTimersByTimeAsync(GPU_READY_POLL_MS);
        await waiting;
        expect(mockApiFetch).toHaveBeenCalledTimes(3);
        expect(onWaking).toHaveBeenCalledTimes(1);
    });

    it('treats a failed probe as still waking and keeps going', async () => {
        mockApiFetch
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce({ ready: true });
        const onWaking = vi.fn();

        const waiting = waitForGpuReady(onWaking);
        await vi.advanceTimersByTimeAsync(GPU_READY_POLL_MS);
        await waiting;

        expect(mockApiFetch).toHaveBeenCalledTimes(2);
        expect(onWaking).toHaveBeenCalledTimes(1);
    });

    it('gives up with a retryable message once the GPU has had its full allowance', async () => {
        mockApiFetch.mockResolvedValue({ ready: false });

        const waiting = waitForGpuReady();
        const outcome = expect(waiting).rejects.toThrow(/taking longer than usual.*try again/i);
        await vi.advanceTimersByTimeAsync(GPU_READY_TIMEOUT_MS + GPU_READY_POLL_MS);
        await outcome;

        const probes = mockApiFetch.mock.calls.length;
        await vi.advanceTimersByTimeAsync(GPU_READY_POLL_MS * 3);
        expect(mockApiFetch).toHaveBeenCalledTimes(probes);
    });
});

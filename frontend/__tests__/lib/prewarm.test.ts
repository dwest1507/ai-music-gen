import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startPrewarm, PREWARM_HEARTBEAT_MS, PREWARM_CEILING_MS } from '@/lib/prewarm';
import { apiFetch } from '@/lib/api';

vi.mock('@/lib/api', () => ({
    apiFetch: vi.fn(async () => ({ warm: true })),
}));

function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => state,
    });
}

describe('startPrewarm', () => {
    let stop: () => void;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.mocked(apiFetch).mockClear();
        setVisibility('visible');
    });

    afterEach(() => {
        stop?.();
        vi.useRealTimers();
    });

    it('does not wake the GPU before the visitor interacts', () => {
        stop = startPrewarm();

        // Crawlers load the page and emit none of these events. Waking on mount
        // would put the GPU bill at the mercy of bot traffic we do not control.
        expect(apiFetch).not.toHaveBeenCalled();
    });

    it('wakes the GPU on the first genuine interaction', () => {
        stop = startPrewarm();

        window.dispatchEvent(new Event('pointermove'));

        expect(apiFetch).toHaveBeenCalledWith('/api/warmup', { method: 'POST' });
    });

    it('wakes the GPU only once however many interactions follow', () => {
        stop = startPrewarm();

        window.dispatchEvent(new Event('pointermove'));
        window.dispatchEvent(new Event('keydown'));
        window.dispatchEvent(new Event('scroll'));

        expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    it('holds the GPU warm with a heartbeat while the visitor is still here', async () => {
        stop = startPrewarm();
        window.dispatchEvent(new Event('pointermove'));

        await vi.advanceTimersByTimeAsync(PREWARM_HEARTBEAT_MS);

        expect(apiFetch).toHaveBeenCalledTimes(2);
    });

    it('stops paying for a backgrounded tab', async () => {
        stop = startPrewarm();
        window.dispatchEvent(new Event('pointermove'));
        setVisibility('hidden');

        await vi.advanceTimersByTimeAsync(PREWARM_HEARTBEAT_MS * 2);

        expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    it('gives up on an idle visitor once the ceiling passes', async () => {
        // Without this, a tab left open and visible on a second monitor holds a
        // GPU warm all day.
        stop = startPrewarm();
        window.dispatchEvent(new Event('pointermove'));

        await vi.advanceTimersByTimeAsync(PREWARM_CEILING_MS * 3);

        const beatsWithinCeiling = Math.ceil(PREWARM_CEILING_MS / PREWARM_HEARTBEAT_MS);
        expect(vi.mocked(apiFetch).mock.calls.length).toBeLessThanOrEqual(
            beatsWithinCeiling
        );
    });
});

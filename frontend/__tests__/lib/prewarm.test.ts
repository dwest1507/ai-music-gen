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

    it('wakes the GPU again when a visitor returns after the ceiling', async () => {
        // The ceiling stops paying for someone who walked away; it must not
        // decide they are gone for good. Staying detached meant the first lull
        // disabled prewarm for the life of the tab, so a visitor who came back
        // and generated a song paid a full cold start.
        stop = startPrewarm();
        window.dispatchEvent(new Event('pointermove'));
        await vi.advanceTimersByTimeAsync(PREWARM_CEILING_MS * 2);
        vi.mocked(apiFetch).mockClear();

        window.dispatchEvent(new Event('pointermove'));

        expect(apiFetch).toHaveBeenCalledWith('/api/warmup', { method: 'POST' });
    });

    it('reports the GPU as cold once it stops holding it warm', async () => {
        // The form labels its wait from this answer. Leaving the last warm reply
        // standing after we let the container go promises a wait we can no
        // longer deliver.
        const onStatus = vi.fn();
        stop = startPrewarm(onStatus);
        window.dispatchEvent(new Event('pointermove'));

        await vi.advanceTimersByTimeAsync(PREWARM_CEILING_MS * 2);

        expect(onStatus).toHaveBeenLastCalledWith({ warm: false });
    });

    it('stops listening once the caller cleans up', async () => {
        // Re-arming at the ceiling must not outlive the component that started it.
        stop = startPrewarm();
        window.dispatchEvent(new Event('pointermove'));
        await vi.advanceTimersByTimeAsync(PREWARM_CEILING_MS * 2);
        stop();
        vi.mocked(apiFetch).mockClear();

        window.dispatchEvent(new Event('pointermove'));

        expect(apiFetch).not.toHaveBeenCalled();
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

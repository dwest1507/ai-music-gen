import { apiFetch } from "./api";

/**
 * Speculative GPU prewarm.
 *
 * Modal wake dominates the wait for a first song — measured at 33-62s for an
 * ordinary snapshot restore and ~122s when the snapshot is rebuilt — and none of
 * it can overlap with anything, because nothing contacts the GPU until a Task is
 * submitted. Waking on the visitor's first interaction moves that wake into the
 * time they were going to spend reading the page and filling the form anyway.
 *
 * See SPEC.md FR-16/FR-17 and ADR 0001 for why this spends money speculatively.
 */

/** Kept below the GPU's own scale-to-zero window so a beat lands before it lapses. */
export const PREWARM_HEARTBEAT_MS = 240_000;

/**
 * How long we keep paying for a visitor who has stopped doing anything.
 *
 * Without a ceiling, a tab left open and visible — someone pulled into a meeting
 * with the page still on a second monitor — would hold a GPU warm all day. Once
 * this passes we let the container go; a visitor idle this long is not in a hurry.
 */
export const PREWARM_CEILING_MS = 600_000;

/**
 * Events a real person emits within a second or two of the page painting, and a
 * headless crawler emits none of. This is the bot guard: triggering on mount
 * instead would put the GPU bill at the mercy of traffic we do not control.
 */
const INTERACTION_EVENTS = ["pointermove", "keydown", "touchstart", "scroll"] as const;

export interface WarmStatus {
    warm: boolean;
}

/**
 * Begin watching for the first interaction. Returns a cleanup function.
 *
 * @param onStatus called with each upstream answer, so the UI can name the phase
 *                 the visitor is actually in rather than guessing.
 */
export function startPrewarm(onStatus?: (status: WarmStatus) => void): () => void {
    let triggered = false;
    let startedAt = 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    const wake = async () => {
        try {
            const status = await apiFetch<WarmStatus>("/api/warmup", { method: "POST" });
            onStatus?.(status);
        } catch {
            // Opportunistic: the visitor has not asked for anything yet, so a
            // failed prewarm costs them nothing they already had.
        }
    };

    const stopHeartbeat = () => {
        if (timer !== null) {
            clearInterval(timer);
            timer = null;
        }
    };

    const beat = () => {
        if (Date.now() - startedAt >= PREWARM_CEILING_MS) {
            stopHeartbeat();
            return;
        }
        // Skip rather than stop: a backgrounded tab pays nothing, but a visitor
        // who returns within the ceiling picks the heartbeat back up.
        if (document.visibilityState !== "visible") return;
        void wake();
    };

    const detach = () => {
        for (const event of INTERACTION_EVENTS) {
            window.removeEventListener(event, trigger);
        }
    };

    function trigger() {
        if (triggered) return;
        triggered = true;
        startedAt = Date.now();
        detach();
        void wake();
        timer = setInterval(beat, PREWARM_HEARTBEAT_MS);
    }

    for (const event of INTERACTION_EVENTS) {
        window.addEventListener(event, trigger, { passive: true });
    }

    return () => {
        detach();
        stopHeartbeat();
    };
}

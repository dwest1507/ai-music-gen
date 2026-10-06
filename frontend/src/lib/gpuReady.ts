/**
 * Waits for the GPU to be able to take a Task before the visitor's song is submitted.
 *
 * A Modal wake that rebuilds its snapshot takes minutes, and Railway closes any
 * request that sends nothing for five. Holding /api/generate open through the wake
 * lost the response even though the song was made, so instead we probe with short
 * requests and submit only once the GPU answers. See ADR 0005.
 */
import { apiFetch } from "@/lib/api";

/** Each probe can itself wait ten seconds on a cold GPU, so this is the gap between them. */
export const GPU_READY_POLL_MS = 5_000;

/**
 * Snapshot rebuilds have taken six minutes in production. Ten leaves room for a slow
 * one while still ending a wait that something has actually broken.
 */
export const GPU_READY_TIMEOUT_MS = 10 * 60 * 1000;

interface GpuReadyStatus {
    ready: boolean;
}

async function probe(): Promise<boolean> {
    try {
        const { ready } = await apiFetch<GpuReadyStatus>("/api/gpu-ready");
        return ready;
    } catch {
        // A refused or dropped probe tells us nothing about the GPU. Count it as
        // still waking and ask again, rather than ending a wait that may be nearly over.
        return false;
    }
}

/**
 * @param onWaking Called once, the first time a probe finds the GPU cold, so the UI
 *     can say it is waking rather than submitting.
 */
export async function waitForGpuReady(onWaking?: () => void): Promise<void> {
    const deadline = Date.now() + GPU_READY_TIMEOUT_MS;
    let toldWaking = false;
    for (;;) {
        if (await probe()) return;
        if (Date.now() >= deadline) {
            throw new Error(
                "The GPU is taking longer than usual to start. Please try again in a minute.",
            );
        }
        if (!toldWaking) {
            onWaking?.();
            toldWaking = true;
        }
        await new Promise((resolve) => setTimeout(resolve, GPU_READY_POLL_MS));
    }
}

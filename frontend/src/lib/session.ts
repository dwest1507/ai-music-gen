import { apiFetch } from "./api";

/**
 * Ensures the session is valid by making a lightweight request to the API.
 * The backend should set the session cookie if strictly necessary.
 */
export async function ensureSession(): Promise<void> {
    try {
        // Health check or a specific session endpoint could be used here.
        // For now, we assume any API call will refresh/set the session cookie.
        await apiFetch("/health");
    } catch (error) {
        console.error("Failed to ensure session:", error);
    }
}

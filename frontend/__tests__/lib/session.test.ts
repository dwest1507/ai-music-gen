import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { ensureSession } from '@/lib/session';

vi.mock('@/lib/api', () => ({
    apiFetch: vi.fn(),
}));

import { apiFetch } from '@/lib/api';
const mockApiFetch = apiFetch as Mock;

describe('ensureSession', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls apiFetch /health and resolves on success', async () => {
        mockApiFetch.mockResolvedValue({ status: 'healthy' });

        await expect(ensureSession()).resolves.toBeUndefined();
        expect(mockApiFetch).toHaveBeenCalledWith('/health');
    });

    it('swallows errors and resolves even when apiFetch throws', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockApiFetch.mockRejectedValue(new Error('Network error'));

        await expect(ensureSession()).resolves.toBeUndefined();
        expect(consoleError).toHaveBeenCalled();

        consoleError.mockRestore();
    });
});

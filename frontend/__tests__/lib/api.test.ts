import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { apiFetch, ApiError, getRandomExample } from '@/lib/api';

describe('apiFetch', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        // Reset fetch mock
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('performs GET request correctly', async () => {
        const mockResponse = { data: 'test' };
        (global.fetch as Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockResponse,
        });

        const result = await apiFetch('/test');

        expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/test', expect.objectContaining({
            headers: expect.objectContaining({
                'Content-Type': 'application/json',
            }),
        }));
        expect(result).toEqual(mockResponse);
    });

    it('throws ApiError on non-ok response', async () => {
        (global.fetch as Mock).mockResolvedValue({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            json: async () => ({ message: 'Invalid input' }),
        });

        await expect(apiFetch('/test')).rejects.toThrow(ApiError);
        await expect(apiFetch('/test')).rejects.toThrow('API Error 400: Bad Request');
    });

    it('returns empty object for 204 No Content', async () => {
        (global.fetch as Mock).mockResolvedValue({
            ok: true,
            status: 204,
        });

        const result = await apiFetch('/test');
        expect(result).toEqual({});
    });

    it('uses fallback error data when json() fails on error response', async () => {
        (global.fetch as Mock).mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => { throw new Error('not json'); },
        });

        await expect(apiFetch('/test')).rejects.toThrow(ApiError);
    });
});

describe('getRandomExample', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('calls the correct endpoint with no query params', async () => {
        const mockExample = {
            prompt: 'A simple track',
            lyrics: '',
            vocal_language: 'en',
        };
        (global.fetch as Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockExample,
        });

        const result = await getRandomExample();
        expect(global.fetch).toHaveBeenCalledWith(
            'http://localhost:8000/api/examples/random',
            expect.anything()
        );
        expect(result.prompt).toBe('A simple track');
    });
});

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

    it('calls the correct endpoint without isAdvanced', async () => {
        const mockExample = {
            is_advanced: false,
            prompt: 'A simple track',
            lyrics: '',
            vocal_language: 'en',
            duration: 60,
            thinking: true,
        };
        (global.fetch as Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockExample,
        });

        const result = await getRandomExample();
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/examples/random'),
            expect.anything()
        );
        const url = (global.fetch as Mock).mock.calls[0][0] as string;
        expect(url).not.toContain('is_advanced');
        expect(result.prompt).toBe('A simple track');
    });

    it('appends is_advanced=true when true', async () => {
        (global.fetch as Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                is_advanced: true, prompt: 'Advanced', lyrics: '', vocal_language: 'en', duration: 90, thinking: true,
            }),
        });

        await getRandomExample(true);
        const url = (global.fetch as Mock).mock.calls[0][0] as string;
        expect(url).toContain('is_advanced=true');
    });

    it('appends is_advanced=false when false', async () => {
        (global.fetch as Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                is_advanced: false, prompt: 'Simple', lyrics: '', vocal_language: 'en', duration: 30, thinking: true,
            }),
        });

        await getRandomExample(false);
        const url = (global.fetch as Mock).mock.calls[0][0] as string;
        expect(url).toContain('is_advanced=false');
    });
});

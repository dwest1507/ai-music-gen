import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
    it('merges class names', () => {
        expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
        expect(cn('base', false && 'skip', 'keep')).toBe('base keep');
    });

    it('resolves Tailwind conflicts', () => {
        // twMerge should keep the last conflicting utility
        expect(cn('p-2', 'p-4')).toBe('p-4');
    });

    it('handles undefined and null gracefully', () => {
        expect(cn('base', undefined, null as unknown as string)).toBe('base');
    });
});

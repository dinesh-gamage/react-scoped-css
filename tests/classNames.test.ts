import { describe, it, expect } from 'vitest';
import { classNames } from '../src/classNames';

describe('classNames runtime helper', () => {
    it('joins string arguments with a space', () => {
        expect(classNames('a', 'b', 'c')).toBe('a b c');
    });

    it('skips falsy values', () => {
        expect(classNames('a', false, null, undefined, 0, '', 'b')).toBe('a b');
    });

    it('coerces numbers and bigints to strings', () => {
        expect(classNames('a', 42, BigInt(7))).toBe('a 42 7');
    });

    it('flattens nested arrays recursively', () => {
        expect(classNames('a', ['b', ['c', false, ['d']]])).toBe('a b c d');
    });

    it('uses truthy keys of object arguments', () => {
        expect(classNames('a', { b: true, c: false, d: 1, e: 0, f: 'yes' })).toBe('a b d f');
    });

    it('mixes strings, arrays, and objects together', () => {
        expect(classNames('a', { b: true }, ['c', { d: true, e: false }])).toBe('a b c d');
    });

    it('returns an empty string when given nothing', () => {
        expect(classNames()).toBe('');
    });

    it('returns an empty string when all args are falsy', () => {
        expect(classNames(false, null, undefined, '')).toBe('');
    });
});

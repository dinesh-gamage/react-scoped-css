import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import { scopedCssPostcss } from '../../src/postcss/index';

const HASH = 'testhash';
const FAKE_FILE = '/project/src/Button.css';

async function transform(css: string, opts = {}, from = FAKE_FILE) {
    const result = await postcss([scopedCssPostcss({ salt: HASH, ...opts })]).process(css, { from });
    return result.css;
}

describe('PostCSS plugin', () => {
    it('scopes a simple class selector', async () => {
        const out = await transform('.button { color: red; }');
        expect(out).toContain('.button-');
        expect(out).not.toContain('.button {');
    });

    it('scopes multiple classes in one rule', async () => {
        const out = await transform('.foo, .bar { color: red; }');
        expect(out).toContain('.foo-');
        expect(out).toContain('.bar-');
    });

    it('scopes descendant selectors', async () => {
        const out = await transform('.container .item { display: flex; }');
        expect(out).toContain('.container-');
        expect(out).toContain('.item-');
    });

    it('leaves excluded prefixes untouched', async () => {
        const out = await transform('.uxp-button { color: red; }', { exclude: ['uxp-'] });
        expect(out).toContain('.uxp-button {');
        expect(out).not.toMatch(/\.uxp-button-[0-9a-f]/);
    });

    it('skips .module. files entirely', async () => {
        const out = await transform('.button { color: red; }', {}, '/project/src/Button.module.css');
        expect(out).toBe('.button { color: red; }');
    });

    it('preserves element selectors unchanged', async () => {
        const out = await transform('div { margin: 0; }');
        expect(out).toBe('div { margin: 0; }');
    });

    it('preserves ID selectors unchanged', async () => {
        const out = await transform('#root { display: flex; }');
        expect(out).toBe('#root { display: flex; }');
    });

    it('handles pseudo-classes after a class', async () => {
        const out = await transform('.button:hover { opacity: 0.8; }');
        expect(out).toContain('.button-');
        expect(out).toContain(':hover');
    });

    it('produces a consistent hash (same file = same suffix)', async () => {
        const out1 = await transform('.btn { color: blue; }');
        const out2 = await transform('.btn { color: blue; }');
        expect(out1).toBe(out2);
    });
});

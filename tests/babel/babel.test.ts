import { describe, it, expect } from 'vitest';
import * as babel from '@babel/core';
import plugin from '../../src/babel/index';
import { scopeClass } from '../../src/classNames';

const FAKE_FILE = '/project/src/Button.tsx';
const SALT = 'test-salt';

function transform(code: string, opts = {}) {
    const result = babel.transformSync(code, {
        filename: FAKE_FILE,
        plugins: [[plugin, { salt: SALT, ...opts }]],
        parserOpts: { plugins: ['jsx', 'typescript'] },
        generatorOpts: { retainLines: false },
        configFile: false,
        babelrc: false,
    });
    return result?.code ?? '';
}

// Grab the hash that will be produced for FAKE_FILE + SALT
import { generateHash } from '../../src/shared/hash';
const HASH = generateHash(FAKE_FILE, SALT);

describe('Babel plugin — all 9 className patterns', () => {
    it('1. String literal: className="foo bar"', () => {
        const out = transform(`const el = <div className="foo bar" />;`);
        expect(out).toContain(`"foo-${HASH} bar-${HASH}"`);
    });

    it('2. JSX string expression: className={"foo"}', () => {
        const out = transform(`const el = <div className={"foo"} />;`);
        expect(out).toContain(`"foo-${HASH}"`);
    });

    it('3. Template literal (static): className={`foo`}', () => {
        const out = transform('const el = <div className={`foo`} />;');
        expect(out).toContain(`foo-${HASH}`);
    });

    it('4. Template literal (dynamic part): className={`foo ${x}`}', () => {
        const out = transform('const el = <div className={`foo ${x}`} />;');
        expect(out).toContain(`foo-${HASH}`);
        expect(out).toContain('scopeClass');
    });

    it('5. Template literal (complex expr): className={`${a ? "on" : "off"} base`}', () => {
        const out = transform('const el = <div className={`${a ? "on" : "off"} base`} />;');
        expect(out).toContain(`base-${HASH}`);
        expect(out).toContain('scopeClass');
    });

    it('6. Variable: className={myClass}', () => {
        const out = transform(`const el = <div className={myClass} />;`);
        expect(out).toContain(`scopeClass(myClass, "${HASH}")`);
    });

    it('7. classNames() call: className={classNames("foo", {bar: x})}', () => {
        const out = transform(`const el = <div className={classNames("foo", {"bar": x})} />;`);
        expect(out).toContain(`"foo-${HASH}"`);
        expect(out).toContain(`"bar-${HASH}"`);
        expect(out).not.toContain('scopeClass');  // classNames args are static — no runtime needed
    });

    it('8. Ternary: className={x ? "a" : "b"}', () => {
        const out = transform(`const el = <div className={x ? "a" : "b"} />;`);
        expect(out).toContain(`"a-${HASH}"`);
        expect(out).toContain(`"b-${HASH}"`);
    });

    it('9. Excluded prefix: className="uxp-button"', () => {
        const out = transform(`const el = <div className="uxp-button" />;`, { exclude: ['uxp-'] });
        expect(out).toContain('"uxp-button"');
        expect(out).not.toContain(`uxp-button-${HASH}`);
    });

    it('injects scopeClass import only when dynamic expressions are present', () => {
        const staticOnly = transform(`const el = <div className="foo" />;`);
        expect(staticOnly).not.toContain('import');

        const dynamic = transform(`const el = <div className={myClass} />;`);
        expect(dynamic).toMatch(/from ['"]react-scoped-css['"]/);
    });

    it('does not double-inject scopeClass import', () => {
        const code = `
import { scopeClass } from 'react-scoped-css';
const el = <div className={myClass} />;`;
        const out = transform(code);
        const count = (out.match(/from 'react-scoped-css'/g) ?? []).length;
        expect(count).toBe(1);
    });

    it('leaves non-className JSX attributes untouched', () => {
        const out = transform(`const el = <div id="foo" data-class="bar" />;`);
        expect(out).toContain('"foo"');
        expect(out).not.toContain(`foo-${HASH}`);
    });

    it('handles mixed excluded and non-excluded in one className', () => {
        const out = transform(`const el = <div className="uxp-button primary" />;`, { exclude: ['uxp-'] });
        expect(out).toContain('uxp-button');
        expect(out).toContain(`primary-${HASH}`);
        expect(out).not.toContain(`uxp-button-${HASH}`);
    });
});

describe('Babel plugin — scopeClass runtime helper', () => {
    it('scopes a string value', () => {
        expect(scopeClass('foo bar', 'abc12345')).toBe('foo-abc12345 bar-abc12345');
    });

    it('handles null/undefined', () => {
        expect(scopeClass(null, 'abc12345')).toBe('');
        expect(scopeClass(undefined, 'abc12345')).toBe('');
    });

    it('handles arrays', () => {
        expect(scopeClass(['foo', 'bar'], 'abc12345')).toBe('foo-abc12345 bar-abc12345');
    });

    it('respects exclude prefixes at runtime', () => {
        expect(scopeClass('uxp-button primary', 'abc12345', ['uxp-'])).toBe('uxp-button primary-abc12345');
    });
});

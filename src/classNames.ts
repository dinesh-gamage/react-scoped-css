/**
 * Runtime helper injected by the Babel plugin for dynamic className expressions.
 *
 * Appends `-{hash}` to every class name token in `value`. Handles strings,
 * arrays, null, and undefined gracefully. Static string literals never reach
 * this function — the Babel plugin inlines the hash at compile time.
 *
 * @param value   The dynamic className value from JSX.
 * @param hash    The 8-char file hash generated at compile time.
 * @param exclude Class name prefixes to leave unscoped.
 */
export function scopeClass(
    value: string | string[] | null | undefined,
    hash: string,
    exclude: string[] = [],
): string {
    if (value == null) return '';
    if (Array.isArray(value)) {
        return value.map(v => scopeClass(v, hash, exclude)).filter(Boolean).join(' ');
    }
    return value
        .split(/\s+/)
        .filter(Boolean)
        .map(cls => {
            if (exclude.some(prefix => cls.startsWith(prefix))) return cls;
            return `${cls}-${hash}`;
        })
        .join(' ');
}

// ---------------------------------------------------------------------------
// classNames — drop-in replacement for the `classnames` npm package
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
type ClassValue =
    | string
    | number
    | bigint
    | boolean
    | null
    | undefined
    | ClassDictionary
    | ClassValue[];

interface ClassDictionary {
    [key: string]: any;
}

/**
 * Build a className string from a variadic list of strings, arrays, and
 * `{ className: condition }` objects. Mirrors the API of the `classnames`
 * npm package so consumers can drop this in without changing call sites.
 *
 * The Babel plugin recognizes `classNames(...)` calls and rewrites static
 * string arguments and string-literal object keys with the per-file hash at
 * compile time — so authoring `classNames('foo', { bar: x })` produces the
 * same scoped output as authoring two static strings in a ternary.
 */
export function classNames(...args: ClassValue[]): string {
    const out: string[] = [];
    for (const arg of args) {
        if (!arg) continue;
        const argType = typeof arg;
        if (argType === 'string' || argType === 'number' || argType === 'bigint') {
            out.push(String(arg));
        } else if (Array.isArray(arg)) {
            const inner = classNames(...arg);
            if (inner) out.push(inner);
        } else if (argType === 'object') {
            const dict = arg as ClassDictionary;
            for (const key of Object.keys(dict)) {
                if (dict[key]) out.push(key);
            }
        }
    }
    return out.join(' ');
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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

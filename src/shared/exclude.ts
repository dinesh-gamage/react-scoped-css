/**
 * Returns true if className should be left unscoped.
 *
 * A class is excluded when its string value starts with any of the configured
 * prefixes. This is the intended behaviour for component-library overrides:
 * `exclude: ['uxp-', 'global-']` leaves `uxp-button` and `global-header`
 * untouched while scoping everything else.
 */
export function isExcluded(className: string, excludePrefixes: string[]): boolean {
    if (excludePrefixes.length === 0) return false;
    return excludePrefixes.some(prefix => className.startsWith(prefix));
}

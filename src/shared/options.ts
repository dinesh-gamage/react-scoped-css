export interface ScopedCssOptions {
    /**
     * Class name prefixes to leave unscoped.
     * Any class whose string value starts with one of these prefixes is left
     * exactly as written — useful for component-library overrides.
     * Default: []
     *
     * @example exclude: ['uxp-', 'global-']
     */
    exclude?: string[];

    /**
     * Override the auto-detected salt used in hash generation.
     * Defaults to the `name` field from the nearest package.json.
     * Set explicitly in monorepos or multi-app deployments to guarantee
     * globally unique class names across apps.
     */
    salt?: string;

    /**
     * Number of hex characters in the generated hash suffix.
     * Default: 8
     */
    hashLength?: number;
}

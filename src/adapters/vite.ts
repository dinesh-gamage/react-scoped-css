import type { Plugin } from 'vite';
import type { ScopedCssOptions } from '../shared/options';
import { scopedCssPostcss } from '../postcss/index';
import reactScopedCssBabelPlugin from '../babel/index';

/**
 * Vite plugin — wires up both the Babel and PostCSS plugins automatically.
 *
 * Usage (vite.config.ts):
 *   import { scopedCss } from 'react-scoped-css/vite';
 *   export default defineConfig({
 *     plugins: [react(), scopedCss({ exclude: ['uxp-', 'global-'] })]
 *   });
 */
export function scopedCss(opts: ScopedCssOptions = {}): Plugin {
    return {
        name: 'react-scoped-css',
        enforce: 'pre',

        config() {
            return {
                css: {
                    postcss: {
                        plugins: [scopedCssPostcss(opts)],
                    },
                },
            };
        },

        transform(code, id) {
            // Only process JS/JSX/TSX files
            if (!/\.[jt]sx?$/.test(id) || id.includes('node_modules')) return;

            // Only transform files that contain className
            if (!code.includes('className')) return;

            // Lazy-load Babel to avoid hard dep when not needed
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const babel = require('@babel/core') as typeof import('@babel/core');

            const result = babel.transformSync(code, {
                filename: id,
                plugins: [[reactScopedCssBabelPlugin, opts]],
                parserOpts: { plugins: ['jsx', 'typescript'] },
                generatorOpts: { retainLines: true },
                sourceMaps: true,
                configFile: false,
                babelrc: false,
            });

            if (!result?.code) return;
            return { code: result.code, map: result.map ?? undefined };
        },
    };
}

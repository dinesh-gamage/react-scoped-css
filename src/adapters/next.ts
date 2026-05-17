import type { ScopedCssOptions } from '../shared/options';
import { scopedCssPostcss } from '../postcss/index';
import reactScopedCssBabelPlugin from '../babel/index';

type NextConfig = Record<string, unknown> & {
    webpack?: (config: WebpackConfig, options: NextWebpackOptions) => WebpackConfig;
    experimental?: { turbo?: unknown };
};

type WebpackConfig = {
    module?: { rules?: WebpackRule[] };
    [key: string]: unknown;
};

type WebpackRule = {
    test?: RegExp;
    use?: WebpackUse | WebpackUse[];
    [key: string]: unknown;
};

type WebpackUse = {
    loader?: string;
    options?: {
        plugins?: unknown[];
        presets?: unknown[];
        postcssOptions?: { plugins?: unknown[] };
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

type NextWebpackOptions = { isServer: boolean; [key: string]: unknown };

/**
 * Next.js config wrapper — injects Babel + PostCSS plugins automatically.
 *
 * Usage (next.config.js):
 *   const { withScopedCss } = require('react-scoped-css/next');
 *   module.exports = withScopedCss({ exclude: ['uxp-'] })({ ... next config ... });
 */
export function withScopedCss(opts: ScopedCssOptions = {}) {
    return function (nextConfig: NextConfig = {}): NextConfig {
        return {
            ...nextConfig,
            webpack(config: WebpackConfig, options: NextWebpackOptions) {
                // Inject into babel-loader rules
                const rules: WebpackRule[] = config.module?.rules ?? [];
                for (const rule of rules) {
                    const uses = Array.isArray(rule.use) ? rule.use : [rule.use].filter(Boolean);
                    for (const use of uses as WebpackUse[]) {
                        if (use?.loader?.includes('babel-loader')) {
                            use.options ??= {};
                            use.options.plugins ??= [];
                            (use.options.plugins as unknown[]).push([reactScopedCssBabelPlugin, opts]);
                        }
                        if (use?.loader?.includes('postcss-loader')) {
                            use.options ??= {};
                            use.options.postcssOptions ??= {};
                            use.options.postcssOptions.plugins ??= [];
                            (use.options.postcssOptions.plugins as unknown[]).push(scopedCssPostcss(opts));
                        }
                    }
                }

                // Call existing webpack config if present
                if (typeof nextConfig.webpack === 'function') {
                    return nextConfig.webpack(config, options);
                }
                return config;
            },
        };
    };
}

import type { ScopedCssOptions } from '../shared/options';
import { scopedCssPostcss } from '../postcss/index';
import reactScopedCssBabelPlugin from '../babel/index';

/**
 * webpack config helper — returns the two plugin instances to splice into
 * your existing babel-loader and postcss-loader rules.
 *
 * Usage (webpack.config.js):
 *   const { scopedCssWebpack } = require('react-scoped-css/webpack');
 *   const { babelPlugin, postcssPlugin } = scopedCssWebpack({ exclude: ['uxp-'] });
 *
 *   // In module.rules, find your babel-loader rule and add:
 *   //   options.plugins: [...existingPlugins, babelPlugin]
 *   // In your postcss-loader rule:
 *   //   options.postcssOptions.plugins: [...existingPlugins, postcssPlugin]
 */
export function scopedCssWebpack(opts: ScopedCssOptions = {}): {
    babelPlugin: [typeof reactScopedCssBabelPlugin, ScopedCssOptions];
    postcssPlugin: ReturnType<typeof scopedCssPostcss>;
} {
    return {
        babelPlugin: [reactScopedCssBabelPlugin, opts],
        postcssPlugin: scopedCssPostcss(opts),
    };
}

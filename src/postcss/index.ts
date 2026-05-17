import type { PluginCreator } from 'postcss';
import { generateHash } from '../shared/hash';
import { isExcluded } from '../shared/exclude';
import type { ScopedCssOptions } from '../shared/options';

// Matches a CSS class selector token: .foo, .foo-bar, ._private, etc.
// Captures the class name without the leading dot.
const CLASS_SELECTOR_RE = /\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g;

/**
 * PostCSS plugin — appends `-{hash}` to every class selector in the file,
 * unless the class name starts with an excluded prefix.
 *
 * Files whose path contains `.module.` are skipped entirely — they are already
 * handled by CSS Modules and must not be double-processed.
 *
 * Usage (postcss.config.js):
 *   const { scopedCssPostcss } = require('react-scoped-css/postcss');
 *   module.exports = { plugins: [scopedCssPostcss({ exclude: ['uxp-'] })] };
 */
const plugin: PluginCreator<ScopedCssOptions> = (opts: ScopedCssOptions = {}) => {
    const { exclude = [], salt, hashLength = 8 } = opts;

    return {
        postcssPlugin: 'react-scoped-css',

        prepare(result) {
            const filePath = result.opts.from;

            // Skip CSS Modules files — they are already scoped.
            if (!filePath || filePath.includes('.module.')) {
                return {};
            }

            const hash = generateHash(filePath, salt, hashLength);

            return {
                Rule(rule) {
                    rule.selector = rule.selector.replace(
                        CLASS_SELECTOR_RE,
                        (match, className: string) => {
                            if (isExcluded(className, exclude)) return match;
                            return `.${className}-${hash}`;
                        },
                    );
                },
            };
        },
    };
};

plugin.postcss = true;

export { plugin as scopedCssPostcss };
export default plugin;

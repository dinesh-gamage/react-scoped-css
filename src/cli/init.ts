#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

type Bundler = 'vite' | 'next' | 'webpack' | 'unknown';

function detectBundler(cwd: string): Bundler {
    const pkgPath = path.join(cwd, 'package.json');
    if (!fs.existsSync(pkgPath)) return 'unknown';

    let pkg: Record<string, unknown> = {};
    try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
    } catch {
        return 'unknown';
    }

    const allDeps = {
        ...(pkg.dependencies as Record<string, string> ?? {}),
        ...(pkg.devDependencies as Record<string, string> ?? {}),
    };

    if ('next' in allDeps) return 'next';
    if ('vite' in allDeps) return 'vite';
    if ('webpack' in allDeps) return 'webpack';
    return 'unknown';
}

const snippets: Record<Bundler, string> = {
    vite: `
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { scopedCss } from 'react-scoped-css/vite';

export default defineConfig({
  plugins: [
    react(),
    scopedCss({ exclude: ['global-'] }),  // add your lib prefixes here
  ],
});
`,

    next: `
// next.config.js
const { withScopedCss } = require('react-scoped-css/next');

module.exports = withScopedCss({
  exclude: ['global-'],  // add your lib prefixes here
})({
  // ...your existing Next.js config
});
`,

    webpack: `
// webpack.config.js
const { scopedCssWebpack } = require('react-scoped-css/webpack');
const { babelPlugin, postcssPlugin } = scopedCssWebpack({
  exclude: ['global-'],  // add your lib prefixes here
});

// In your module.rules, find the babel-loader rule and add babelPlugin:
//   use: { loader: 'babel-loader', options: { plugins: [...existing, babelPlugin] } }
//
// Find the postcss-loader rule and add postcssPlugin:
//   use: { loader: 'postcss-loader', options: { postcssOptions: { plugins: [...existing, postcssPlugin] } } }
`,

    unknown: `
// Bundler not detected — choose the config that matches your setup:
//
// Vite:    import { scopedCss } from 'react-scoped-css/vite';
// Next.js: const { withScopedCss } = require('react-scoped-css/next');
// webpack: const { scopedCssWebpack } = require('react-scoped-css/webpack');
//
// See README for full setup instructions.
`,
};

function main() {
    const cwd = process.cwd();
    const bundler = detectBundler(cwd);
    const snippet = snippets[bundler];

    const label = bundler === 'unknown' ? 'Bundler not detected' : `Detected: ${bundler}`;

    console.log('');
    console.log(`react-scoped-css init — ${label}`);
    console.log('─'.repeat(50));
    console.log('');
    console.log('Step 1 — Install:');
    console.log('');
    console.log('  npm install react-scoped-css');
    console.log('');
    console.log('Step 2 — Add to your config:');
    console.log(snippet);

    if (bundler !== 'unknown') {
        const configFile =
            bundler === 'vite' ? 'vite.config.ts (or vite.config.js)' :
            bundler === 'next' ? 'next.config.js' :
            'webpack.config.js';
        console.log(`Paste the snippet above into ${configFile}.`);
    }

    console.log('');
    console.log('That\'s it. Start your dev server and class names will be scoped automatically.');
    console.log('');
    console.log('To exclude component-library class names (e.g. uxp-, mantine-):');
    console.log('  scopedCss({ exclude: [\'uxp-\', \'mantine-\'] })');
    console.log('');
}

main();

import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        'index': 'src/index.ts',
        'babel/index': 'src/babel/index.ts',
        'postcss/index': 'src/postcss/index.ts',
        'adapters/vite': 'src/adapters/vite.ts',
        'adapters/next': 'src/adapters/next.ts',
        'adapters/webpack': 'src/adapters/webpack.ts',
        'cli/init': 'src/cli/init.ts',
    },
    format: ['esm', 'cjs'],
    dts: { tsconfig: './tsconfig.build.json' },
    clean: true,
    sourcemap: true,
    splitting: false,
    shims: true,
    banner: {
        js: '// react-scoped-css v2 — https://github.com/dinesh-gamage/react-scoped-css',
    },
});

# react-scoped-css

CSS scoping for React with zero code changes. Write your JSX and CSS exactly as you always have — class names get a per-file hash appended at build time so they never collide.

```tsx
// You write this
<div className="container">
  <button className="btn">Save</button>
</div>
```

```scss
// You write this
.container { padding: 16px; }
.btn { background: blue; }
```

```tsx
// Build output (invisible to you)
<div className="container-a3f9b2c1">
  <button className="btn-a3f9b2c1">Save</button>
</div>
```

```css
/* Build output (invisible to you) */
.container-a3f9b2c1 { padding: 16px; }
.btn-a3f9b2c1 { background: blue; }
```

The hash is derived from the file path — same hash in JSX and CSS, unique per file, identical on every developer machine and in CI.

---

## Why not CSS Modules or CSS-in-JS?

Every existing solution requires you to change how you write code:

| Tool | What you have to change |
|---|---|
| CSS Modules | Rename every import; use `styles.className` everywhere |
| styled-components / Emotion | Entirely different syntax |
| babel-plugin-react-css-modules | Rename `className` to `styleName` |

This tool requires no changes. Add it to your build config once, and existing code is scoped automatically.

---

## Install

```bash
npm install react-scoped-css
```

Then run the init command to get the config snippet for your bundler:

```bash
npx react-scoped-css init
```

---

## Setup

### Vite

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { scopedCss } from 'react-scoped-css/vite';

export default defineConfig({
  plugins: [
    react(),
    scopedCss({ exclude: ['global-'] }),
  ],
});
```

### Next.js

```js
// next.config.js
const { withScopedCss } = require('react-scoped-css/next');

module.exports = withScopedCss({
  exclude: ['global-'],
})({
  // ...your existing Next.js config
});
```

### webpack

```js
// webpack.config.js
const { scopedCssWebpack } = require('react-scoped-css/webpack');
const { babelPlugin, postcssPlugin } = scopedCssWebpack({
  exclude: ['global-'],
});

module.exports = {
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        use: {
          loader: 'babel-loader',
          options: {
            plugins: [babelPlugin],
          },
        },
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [postcssPlugin],
              },
            },
          },
        ],
      },
    ],
  },
};
```

### Manual (Babel + PostCSS directly)

If you configure Babel and PostCSS yourself:

```js
// babel.config.js
const { default: scopedCssBabel } = require('react-scoped-css/babel');

module.exports = {
  plugins: [
    [scopedCssBabel, { exclude: ['global-'] }],
  ],
};
```

```js
// postcss.config.js
const { scopedCssPostcss } = require('react-scoped-css/postcss');

module.exports = {
  plugins: [
    scopedCssPostcss({ exclude: ['global-'] }),
  ],
};
```

---

## Excluding class names

Use `exclude` to list class name prefixes that should never be scoped. This is the main mechanism for component library overrides — you want to write `.uxp-button { color: red }` to override a library style, not `.uxp-button-a3f9b2c1`.

```ts
scopedCss({
  exclude: ['uxp-', 'mantine-', 'global-', 'app-'],
})
```

Any class name whose string value starts with an excluded prefix is left exactly as written, in both JSX output and CSS output.

```tsx
// exclude: ['uxp-']

<div className="container uxp-button">
//              ^^^^^^^^^^^^^^^^^^^
//              "container" → "container-a3f9b2c1"
//              "uxp-button" → "uxp-button" (untouched)
```

```scss
.container { padding: 16px; }     // → .container-a3f9b2c1
.uxp-button { font-weight: bold; } // → .uxp-button (untouched)
```

---

## Configuration

```ts
interface ScopedCssOptions {
  /**
   * Class name prefixes to leave unscoped.
   * Default: []
   */
  exclude?: string[];

  /**
   * Override the salt used in hash generation.
   * Defaults to the `name` field from the nearest package.json.
   * Override in monorepos or multi-app deployments to guarantee
   * globally unique class names across apps.
   */
  salt?: string;

  /**
   * Number of hex characters in the hash suffix.
   * Default: 8
   */
  hashLength?: number;
}
```

---

## How it works

**Babel plugin** (`react-scoped-css/babel`) — visits every `className` JSX attribute and appends `-{hash}` to each class name token at compile time. Handles all real-world patterns:

| Pattern | Input | Output |
|---|---|---|
| String literal | `className="foo bar"` | `className="foo-a3f9b2c1 bar-a3f9b2c1"` |
| String expression | `className={"foo"}` | `className={"foo-a3f9b2c1"}` |
| Template literal (static) | `` className={`foo`} `` | `` className={`foo-a3f9b2c1`} `` |
| Template literal (dynamic) | `` className={`foo ${x}`} `` | `` className={`foo-a3f9b2c1 ${scopeClass(x, "a3f9b2c1")}`} `` |
| Variable | `className={myClass}` | `className={scopeClass(myClass, "a3f9b2c1")}` |
| classNames() call | `className={classNames("foo", {bar: x})}` | `className={classNames("foo-a3f9b2c1", {"bar-a3f9b2c1": x})}` |
| Ternary | `className={x ? "a" : "b"}` | `className={x ? "a-a3f9b2c1" : "b-a3f9b2c1"}` |
| Logical | `className={x && "foo"}` | `className={x && "foo-a3f9b2c1"}` |
| Excluded prefix | `className="uxp-button"` | `className="uxp-button"` |

Static string literals are transformed entirely at compile time — no runtime cost, no import added. Dynamic expressions use `scopeClass()`, a small runtime helper that is imported automatically only in files that need it.

**PostCSS plugin** (`react-scoped-css/postcss`) — walks every CSS rule selector and appends `-{hash}` to each class token, matching what the Babel plugin produces. SCSS and Less are supported via `postcss-scss` (bundled). Files matching `*.module.*` are skipped — they are already scoped by CSS Modules.

**Hash** — `MD5(relativeFilePath + salt).slice(0, 8)`. The path is relative to the nearest `package.json`, so the hash is identical on every developer machine and in CI regardless of where the repo is cloned. The salt defaults to the `name` field from `package.json`, which makes hashes globally unique across different apps without any configuration.

---

## Known limitations

**Dynamic class names set outside JSX** — `element.className = 'foo'` and `document.createElement` calls are not transformed. The Babel plugin only processes JSX `className` attributes. Workaround: use `scopeClass` from `react-scoped-css` directly:

```ts
import { scopeClass } from 'react-scoped-css';
// you need to supply the hash manually — get it from the build output
```

For most React codebases this is not an issue.

**Template literals with nested `classNames()` calls** — `` className={`wrapper ${classNames({active: x})}`} `` — the outer template literal is processed but the inner `classNames()` call is not recursively transformed. Workaround: move the `classNames()` call outside the template literal.

**Third-party components that accept `className`** — A library component that uses your scoped class name internally (not just forwards it to a DOM element) may not match your CSS. The `exclude` list handles top-level library class names. Internal library classes are unaffected.

**React compiler (experimental)** — Untested with the React 19 compiler. The Babel plugin runs before the React compiler in the standard pipeline, but verify in your specific setup.

---

## Migrating from react-scoped-css-loader (v1)

v1 (`react-scoped-css-loader`) and v2 (`react-scoped-css`) are separate packages. v1 remains on npm unchanged.

To migrate:

```bash
npm uninstall react-scoped-css-loader
npm install react-scoped-css
npx react-scoped-css init
```

Then replace the v1 webpack loader config with the v2 config snippet printed by `init`.

---

## License

MIT

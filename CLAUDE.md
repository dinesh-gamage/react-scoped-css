# react-scoped-css — Claude context

Read this file at the start of every session. It contains enough context to continue work without asking the developer for background.

---

## What this project is

A build-time CSS scoping library for React. The core differentiator: **zero code changes**. Developers write `className="container"` and `.container {}` exactly as they always have. The build tools append a per-file hash at compile time so class names never collide across components.

Package name on npm: `react-scoped-css` (v2, clean slate — the old package `react-scoped-css-loader` is v1 and stays on npm unchanged).

---

## Architecture

Two plugins, one shared hash, three adapters.

```
src/
  shared/hash.ts        MD5(relPathNoExt + salt).slice(0,8) — the core primitive
  shared/exclude.ts     isExcluded(className, prefixes[]) — prefix check
  shared/options.ts     ScopedCssOptions interface { exclude?, salt?, hashLength? }

  babel/index.ts        JSX className transform (Babel AST — all 9 patterns)
  postcss/index.ts      CSS class selector transform (PostCSS rule walker)
  classNames.ts         scopeClass() runtime helper for dynamic expressions

  adapters/vite.ts      Vite plugin — wires up both automatically
  adapters/next.ts      withScopedCss() Next.js config wrapper
  adapters/webpack.ts   scopedCssWebpack() → { babelPlugin, postcssPlugin }

  cli/init.ts           npx react-scoped-css init — detects bundler, prints snippet
  index.ts              root export: { scopeClass, ScopedCssOptions }
```

---

## The hash contract (critical — read this carefully)

Hash = `MD5(relPathWithoutExt + salt).slice(0, hashLength)`

- **Extension stripped**: `Card.tsx` and `Card.scss` both hash to `src/components/Card`. This is what makes the Babel plugin (processing `.tsx`) and PostCSS plugin (processing `.scss`) produce the same hash for the same component. Without this, scoping breaks.
- **Relative path**: relative to the nearest `package.json` root. Ensures hash is identical on every developer's machine and in CI.
- **Salt**: defaults to `name` from the nearest `package.json`. Ensures globally unique class names when multiple apps are deployed together (e.g. UXP multi-widget deployments). Override with explicit `salt` option.
- **Hash length**: 8 hex chars by default. Configurable via `hashLength`.

Source: `src/shared/hash.ts`

---

## Babel plugin — 9 className patterns

The plugin visits every `JSXAttribute` where `name === 'className'`. Transforms:

| Pattern | Input | Output |
|---|---|---|
| String literal | `className="foo bar"` | `className="foo-{h} bar-{h}"` — compile-time, zero runtime |
| String expression | `className={"foo"}` | `className={"foo-{h}"}` — compile-time |
| Template (static) | `` className={`foo`} `` | `` className={`foo-{h}`} `` — compile-time |
| Template (dynamic) | `` className={`foo ${x}`} `` | static part scoped inline, `${scopeClass(x, "{h}")}` for dynamic |
| Variable | `className={myClass}` | `className={scopeClass(myClass, "{h}")}` |
| classNames() | `className={classNames("foo", {bar: x})}` | string args and string-literal object keys scoped inline |
| Ternary | `className={x ? "a" : "b"}` | both branches scoped inline |
| Logical | `className={x && "foo"}` | right side scoped |
| Excluded prefix | `className="uxp-button"` | untouched |

`scopeClass()` import is injected at the top of the file **only** when the file contains at least one dynamic expression. Static-only files get no import, no runtime overhead.

`classNames`, `clsx`, `cx`, `cn` are all recognised as classNames utility calls.

---

## PostCSS plugin

- Walks every `Rule` and rewrites selectors using `CLASS_SELECTOR_RE = /\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g`
- SCSS syntax auto-applied via bundled `postcss-scss` when `filePath` ends in `.scss`/`.sass`
- Skips files where path contains `.module.` (already handled by CSS Modules)
- Exclusion: any class whose name starts with an excluded prefix is left unchanged

---

## Build / test

```bash
npm test          # vitest, 38 tests
npm run build     # tsup — outputs ESM (.mjs) + CJS (.js) + .d.ts for all entry points
npm run lint      # tsc --noEmit — zero type errors required
```

Two tsconfigs:
- `tsconfig.json` — for type checking (includes `src/` + `tests/`)
- `tsconfig.build.json` — for tsup dts generation (src only, sets rootDir)

Package exports map uses `.js` for CJS and `.mjs` for ESM (tsup output convention when no `"type": "module"` in package.json).

---

## Known issues / open work

| Area | Status |
|---|---|
| `tests/e2e/` | Empty — needs full Vite + webpack integration tests |
| Less support | Not implemented — `postcss-less` not bundled, `.less` files not auto-detected |
| Rollup adapter | Not implemented |
| React 19 compiler | Untested |
| Nested `classNames()` inside template literals | Known limitation, documented |

---

## Local test app

A working test widget lives at `~/Downloads/temp/test-app/` — a UXP widget project.

**Components with intentional class name collisions:**
- `Card.tsx` / `Card.scss` — `.card`, `.header`, `.title` (red), `.btn`, `.footer`
- `UserProfile.tsx` / `UserProfile.scss` — same names, `.title` in orange
- `AlertBanner.tsx` / `AlertBanner.scss` — same names again, `.title` 13px bold
- `EdgeCases.tsx` / `EdgeCases.scss` — one section per Babel plugin pattern (11 patterns)

**webpack config** (`webpack.config.js`):
- `babel-loader` runs FIRST on TSX (rightmost in `use` array = first in webpack RTL order)
- `ts-loader` runs second with `transpileOnly: true`
- `postcss-loader` sits between `css-loader` and `sass-loader` in the SCSS rule
- `exclude: ['uxpcore-']`, custom `salt` UUID set

**To rebuild the test app:**
```bash
cd ~/Downloads/temp/test-app
npx webpack --config webpack.config.js
```

**To re-link the local package after any change:**
```bash
cd ~/personal/projects/react-scoped-css
npm run build
npm link
cd ~/Downloads/temp/test-app
npm link react-scoped-css
```

---

## What to work on next

Priority order:

1. **e2e tests** (`tests/e2e/`) — a Vite project and a webpack project, built programmatically in the test, output checked for correct class name scoping. This is the most valuable missing piece.
2. **Less support** — add `postcss-less` as a bundled dep, auto-detect `.less` files in the PostCSS plugin (same pattern as SCSS).
3. **Rollup adapter** (`src/adapters/rollup.ts`) — follow the Vite adapter pattern.
4. **Publish to npm** — create the GitHub repo, push, set `NPM_TOKEN` secret, tag `v2.0.0`.

---

## Publishing checklist (when ready)

1. `git remote add origin https://github.com/dinesh-gamage/react-scoped-css`
2. `git push -u origin master`
3. Add `NPM_TOKEN` to GitHub repo secrets
4. `git tag v2.0.0 && git push --tags` — CI publishes automatically
5. Add deprecation notice to `react-scoped-css-loader` on npm pointing here

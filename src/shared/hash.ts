import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

/** Walk up from `dir` looking for `filename`. Returns the first match or undefined. */
function findUpSync(filename: string, startDir: string): string | undefined {
    let dir = startDir;
    while (true) {
        const candidate = path.join(dir, filename);
        if (fs.existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) return undefined; // reached filesystem root
        dir = parent;
    }
}

function readPackageNameSync(pkgJsonPath: string | undefined): string {
    if (!pkgJsonPath) return '';
    try {
        const raw = fs.readFileSync(pkgJsonPath, 'utf8');
        const pkg = JSON.parse(raw) as { name?: string };
        return typeof pkg.name === 'string' ? pkg.name : '';
    } catch {
        return '';
    }
}

/**
 * Generate a stable 8-char hex hash for a source file.
 *
 * Uses the file's path relative to the nearest package.json root so the hash
 * is identical on every developer machine and in CI, regardless of where the
 * repo is cloned.
 *
 * @param absoluteFilePath  Absolute path to the source file being processed.
 * @param salt              Override the default salt (package.json "name").
 *                          Pass an explicit value to guarantee global uniqueness
 *                          across monorepos or multi-app deployments.
 * @param hashLength        Number of hex characters to use (default: 8).
 */
export function generateHash(
    absoluteFilePath: string,
    salt?: string,
    hashLength = 8,
): string {
    const pkgJsonPath = findUpSync('package.json', path.dirname(absoluteFilePath));
    const projectRoot = pkgJsonPath ? path.dirname(pkgJsonPath) : process.cwd();
    // Strip extension so Card.tsx and Card.scss produce the same hash.
    // A component's scope identity is its path without extension.
    const relativeFilePath = path.relative(projectRoot, absoluteFilePath).replace(/\.[^./\\]+$/, '');

    const effectiveSalt = salt ?? readPackageNameSync(pkgJsonPath);

    return createHash('md5')
        .update(relativeFilePath + effectiveSalt)
        .digest('hex')
        .slice(0, hashLength);
}

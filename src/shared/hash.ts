import { createHash } from 'crypto';
import path from 'path';
import { findUpSync } from 'find-up';

function readPackageNameSync(pkgJsonPath: string | undefined): string {
    if (!pkgJsonPath) return '';
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pkg = require(pkgJsonPath) as { name?: string };
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
    const pkgJsonPath = findUpSync('package.json', {
        cwd: path.dirname(absoluteFilePath),
    });
    const projectRoot = pkgJsonPath ? path.dirname(pkgJsonPath) : process.cwd();
    const relativeFilePath = path.relative(projectRoot, absoluteFilePath);

    const effectiveSalt = salt ?? readPackageNameSync(pkgJsonPath);

    return createHash('md5')
        .update(relativeFilePath + effectiveSalt)
        .digest('hex')
        .slice(0, hashLength);
}

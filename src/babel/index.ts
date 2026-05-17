import type { ConfigAPI, NodePath, PluginObj, PluginPass } from '@babel/core';
import type {
    JSXAttribute,
    Expression,
    StringLiteral,
    JSXExpressionContainer,
    TemplateLiteral,
    CallExpression,
    ConditionalExpression,
    BinaryExpression,
    LogicalExpression,
} from '@babel/types';
import { generateHash } from '../shared/hash';
import { isExcluded } from '../shared/exclude';
import type { ScopedCssOptions } from '../shared/options';

const CLASSNAMES_FUNCTIONS = new Set(['classNames', 'clsx', 'cx', 'cn']);
const SCOPE_CLASS_IMPORT = 'react-scoped-css';

/**
 * Scope a string of space-separated class names.
 * Returns the modified string.
 */
function scopeClassString(value: string, hash: string, exclude: string[]): string {
    return value
        .split(/\s+/)
        .filter(Boolean)
        .map(cls => (isExcluded(cls, exclude) ? cls : `${cls}-${hash}`))
        .join(' ');
}

/**
 * Babel plugin — transforms JSX className attributes so that every class name
 * gets a per-file hash suffix appended.
 *
 * Static string literals are transformed at compile time (zero runtime cost).
 * Dynamic expressions are wrapped with `scopeClass(expr, "hash")` which is
 * imported from 'react-scoped-css' only when needed (tree-shakeable).
 */
export default function reactScopedCssBabelPlugin(
    api: ConfigAPI,
    options: ScopedCssOptions,
): PluginObj {
    const t = api.types;
    const { exclude = [], salt, hashLength = 8 } = options ?? {};

    // Per-file state
    let hash = '';
    let needsScopeClassImport = false;
    let hasScopeClassImport = false;

    function buildScopeClassCall(expr: Expression): CallExpression {
        needsScopeClassImport = true;
        const excludeArg = exclude.length > 0
            ? t.arrayExpression(exclude.map(p => t.stringLiteral(p)))
            : null;
        const args: Expression[] = [expr, t.stringLiteral(hash)];
        if (excludeArg) args.push(excludeArg);
        return t.callExpression(t.identifier('scopeClass'), args);
    }

    /**
     * Transform an expression that appears as the value of className={...}.
     * Returns a new expression (or the same node if no change needed).
     */
    function transformExpr(node: Expression): Expression {
        // String literal: className={"foo bar"}
        if (t.isStringLiteral(node)) {
            const scoped = scopeClassString(node.value, hash, exclude);
            return t.stringLiteral(scoped);
        }

        // Template literal: className={`foo ${x} bar`}
        if (t.isTemplateLiteral(node)) {
            return transformTemplateLiteral(node);
        }

        // Ternary: className={x ? "a" : "b"}
        if (t.isConditionalExpression(node)) {
            return transformConditional(node);
        }

        // Logical: className={x && "foo"}
        if (t.isLogicalExpression(node)) {
            return transformLogical(node);
        }

        // classNames() / clsx() / cx() call
        if (t.isCallExpression(node)) {
            const callee = node.callee;
            if (t.isIdentifier(callee) && CLASSNAMES_FUNCTIONS.has(callee.name)) {
                return transformClassNamesCall(node);
            }
        }

        // Everything else (variable, member expression, etc.) — wrap with scopeClass
        return buildScopeClassCall(node);
    }

    function transformTemplateLiteral(node: TemplateLiteral): Expression {
        // Walk quasis (static parts) and expressions (dynamic parts)
        const newQuasis = node.quasis.map(quasi => {
            const scoped = scopeClassString(quasi.value.cooked ?? quasi.value.raw, hash, exclude);
            const newQuasi = t.templateElement(
                { raw: scoped.replace(/\\/g, '\\\\'), cooked: scoped },
                quasi.tail,
            );
            return newQuasi;
        });

        const newExpressions = (node.expressions as Expression[]).map(expr => {
            // Static string inside template — transform directly
            if (t.isStringLiteral(expr)) {
                return t.stringLiteral(scopeClassString(expr.value, hash, exclude));
            }
            // Dynamic — wrap with scopeClass
            return buildScopeClassCall(expr);
        });

        return t.templateLiteral(newQuasis, newExpressions);
    }

    function transformConditional(node: ConditionalExpression): ConditionalExpression {
        return t.conditionalExpression(
            node.test,
            transformExpr(node.consequent as Expression),
            transformExpr(node.alternate as Expression),
        );
    }

    function transformLogical(node: LogicalExpression): LogicalExpression {
        return t.logicalExpression(
            node.operator,
            node.left as Expression,
            transformExpr(node.right as Expression),
        );
    }

    /**
     * Transform arguments to classNames() / clsx() calls:
     *   - String literal args: scope inline
     *   - Object expression keys that are string literals: scope inline
     *   - Anything else: wrap with scopeClass
     */
    function transformClassNamesCall(node: CallExpression): CallExpression {
        const newArgs = node.arguments.map(arg => {
            if (t.isStringLiteral(arg)) {
                return t.stringLiteral(scopeClassString(arg.value, hash, exclude));
            }
            if (t.isObjectExpression(arg)) {
                const newProps = arg.properties.map(prop => {
                    if (
                        t.isObjectProperty(prop) &&
                        t.isStringLiteral(prop.key)
                    ) {
                        return t.objectProperty(
                            t.stringLiteral(scopeClassString(prop.key.value, hash, exclude)),
                            prop.value as Expression,
                            false,
                            false,
                        );
                    }
                    return prop;
                });
                return t.objectExpression(newProps);
            }
            if (t.isExpression(arg)) {
                return buildScopeClassCall(arg);
            }
            return arg;
        });
        return t.callExpression(node.callee as Expression, newArgs);
    }

    return {
        visitor: {
            Program: {
                enter(_path: NodePath, state: PluginPass) {
                    const filename = state.filename;
                    if (!filename) {
                        hash = 'unknown0';
                        return;
                    }
                    hash = generateHash(filename, salt, hashLength);
                    needsScopeClassImport = false;
                    hasScopeClassImport = false;
                },
                exit(programPath: NodePath) {
                    if (!needsScopeClassImport || hasScopeClassImport) return;
                    // Inject: import { scopeClass } from 'react-scoped-css';
                    const importDecl = t.importDeclaration(
                        [t.importSpecifier(t.identifier('scopeClass'), t.identifier('scopeClass'))],
                        t.stringLiteral(SCOPE_CLASS_IMPORT),
                    );
                    (programPath as NodePath<import('@babel/types').Program>).unshiftContainer(
                        'body',
                        importDecl,
                    );
                },
            },

            // Detect existing scopeClass import so we don't double-inject
            ImportDeclaration(path: NodePath<import('@babel/types').ImportDeclaration>) {
                if (path.node.source.value === SCOPE_CLASS_IMPORT) {
                    hasScopeClassImport = true;
                }
            },

            JSXAttribute(path: NodePath<JSXAttribute>) {
                const nameNode = path.node.name;
                if (
                    !(t.isJSXIdentifier(nameNode) && nameNode.name === 'className')
                ) {
                    return;
                }

                const value = path.node.value;

                // className="foo bar"
                if (t.isStringLiteral(value)) {
                    const scoped = scopeClassString(value.value, hash, exclude);
                    if (scoped !== value.value) {
                        path.node.value = t.stringLiteral(scoped);
                    }
                    return;
                }

                // className={...}
                if (t.isJSXExpressionContainer(value)) {
                    const expr = value.expression;
                    if (t.isJSXEmptyExpression(expr)) return;

                    const transformed = transformExpr(expr as Expression);
                    if (transformed !== expr) {
                        (path.node.value as JSXExpressionContainer).expression = transformed;
                    }
                }
            },
        },
    };
}

import type { ConfigAPI, NodePath, PluginObj, PluginPass } from '@babel/core';
import * as t from '@babel/types';
import type {
    Expression,
    TemplateLiteral,
    CallExpression,
    ConditionalExpression,
    LogicalExpression,
    ObjectProperty,
    ImportDeclaration,
    Program,
} from '@babel/types';
import { generateHash } from '../shared/hash';
import { isExcluded } from '../shared/exclude';
import type { ScopedCssOptions } from '../shared/options';

const CLASSNAMES_FUNCTIONS = new Set(['classNames', 'clsx', 'cx', 'cn']);
const SCOPE_CLASS_IMPORT = '@dinesh-gamage/react-scoped-css';

/** Scope space-separated class names that are static strings. */
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
    _api: ConfigAPI,
    options: ScopedCssOptions,
): PluginObj {
    const { exclude = [], salt, hashLength = 8 } = options ?? {};

    // Per-file state
    let hash = '';
    let needsScopeClassImport = false;
    let hasScopeClassImport = false;

    function buildScopeClassCall(expr: Expression): CallExpression {
        needsScopeClassImport = true;
        const args: Expression[] = [expr, t.stringLiteral(hash)];
        if (exclude.length > 0) {
            args.push(t.arrayExpression(exclude.map(p => t.stringLiteral(p))));
        }
        return t.callExpression(t.identifier('scopeClass'), args);
    }

    /** Transform an Expression used as the value of className={...}. */
    function transformExpr(node: Expression): Expression {
        if (t.isStringLiteral(node)) {
            return t.stringLiteral(scopeClassString(node.value, hash, exclude));
        }
        if (t.isTemplateLiteral(node)) {
            return transformTemplateLiteral(node);
        }
        if (t.isConditionalExpression(node)) {
            return transformConditional(node);
        }
        if (t.isLogicalExpression(node)) {
            return transformLogical(node);
        }
        if (t.isCallExpression(node)) {
            const callee = node.callee;
            if (t.isIdentifier(callee) && CLASSNAMES_FUNCTIONS.has(callee.name)) {
                return transformClassNamesCall(node);
            }
        }
        // Variable, member expression, arbitrary dynamic expr — wrap with scopeClass
        return buildScopeClassCall(node);
    }

    function transformTemplateLiteral(node: TemplateLiteral): TemplateLiteral {
        const newQuasis = node.quasis.map(quasi => {
            const raw = quasi.value.cooked ?? quasi.value.raw;
            const scoped = scopeClassString(raw, hash, exclude);
            return t.templateElement(
                { raw: scoped.replace(/\\/g, '\\\\'), cooked: scoped },
                quasi.tail,
            );
        });

        const newExpressions = node.expressions.map(expr => {
            if (t.isStringLiteral(expr)) {
                return t.stringLiteral(scopeClassString(expr.value, hash, exclude));
            }
            if (t.isExpression(expr)) {
                return buildScopeClassCall(expr);
            }
            // TSType in template literal — leave as is
            return expr;
        });

        return t.templateLiteral(newQuasis, newExpressions);
    }

    function transformConditional(node: ConditionalExpression): ConditionalExpression {
        return t.conditionalExpression(
            node.test,
            transformExpr(node.consequent),
            transformExpr(node.alternate),
        );
    }

    function transformLogical(node: LogicalExpression): LogicalExpression {
        return t.logicalExpression(
            node.operator,
            node.left,
            transformExpr(node.right),
        );
    }

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
                        const newProp: ObjectProperty = t.objectProperty(
                            t.stringLiteral(scopeClassString(prop.key.value, hash, exclude)),
                            prop.value as Expression,
                        );
                        return newProp;
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
                    hash = filename ? generateHash(filename, salt, hashLength) : 'unknown0';
                    needsScopeClassImport = false;
                    hasScopeClassImport = false;
                },

                exit(programPath: NodePath<Program>) {
                    if (!needsScopeClassImport || hasScopeClassImport) return;
                    const importDecl = t.importDeclaration(
                        [t.importSpecifier(t.identifier('scopeClass'), t.identifier('scopeClass'))],
                        t.stringLiteral(SCOPE_CLASS_IMPORT),
                    );
                    programPath.unshiftContainer('body', importDecl);
                },
            },

            ImportDeclaration(path: NodePath<ImportDeclaration>) {
                if (path.node.source.value === SCOPE_CLASS_IMPORT) {
                    hasScopeClassImport = true;
                }
            },

            JSXAttribute(path: NodePath<import('@babel/types').JSXAttribute>) {
                const nameNode = path.node.name;
                if (!t.isJSXIdentifier(nameNode) || nameNode.name !== 'className') return;

                const attrValue = path.node.value;
                if (attrValue == null) return;

                if (t.isStringLiteral(attrValue)) {
                    const scoped = scopeClassString(attrValue.value, hash, exclude);
                    if (scoped !== attrValue.value) {
                        path.node.value = t.stringLiteral(scoped);
                    }
                    return;
                }

                if (t.isJSXExpressionContainer(attrValue)) {
                    const expr = attrValue.expression;
                    if (t.isJSXEmptyExpression(expr)) return;
                    const transformed = transformExpr(expr);
                    if (transformed !== expr) {
                        attrValue.expression = transformed;
                    }
                }
            },
        },
    };
}

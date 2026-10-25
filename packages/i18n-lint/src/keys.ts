/** A key missing from all four catalogues passes parity and renders its own path (sc-11036). */
import ts from 'typescript';

import { keysOf, type Catalogue } from './catalogues.ts';

const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

export interface KeyUse {
  line: number;
  key: string;
}

/** Every `t('…')` and `i18n.t('…')` whose key is written as a literal. */
export function findKeys(fileName: string, source: string): KeyUse[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ESNext,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const uses: KeyUse[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isTranslator(node.expression)) {
      const [first] = node.arguments;

      for (const literal of first == null ? [] : literalsOf(first)) {
        uses.push({
          line: file.getLineAndCharacterOfPosition(literal.getStart(file)).line + 1,
          key: literal.text,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(file, visit);

  return uses;
}

function literalsOf(node: ts.Expression): ts.StringLiteralLike[] {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node];
  if (ts.isParenthesizedExpression(node)) return literalsOf(node.expression);
  if (ts.isConditionalExpression(node)) {
    return [...literalsOf(node.whenTrue), ...literalsOf(node.whenFalse)];
  }

  return [];
}

function isTranslator(callee: ts.Expression): boolean {
  if (ts.isIdentifier(callee)) return callee.text === 't';

  return ts.isPropertyAccessExpression(callee) && callee.name.text === 't';
}

/** A message or the base of a plural family; a branch renders as an object, not a string. */
export function resolves(catalogue: Catalogue | readonly string[], key: string): boolean {
  const keys = Array.isArray(catalogue) ? catalogue : keysOf(catalogue);

  return keys.some(
    (each) => each === key || PLURAL_SUFFIXES.some((suffix) => each === `${key}${suffix}`),
  );
}

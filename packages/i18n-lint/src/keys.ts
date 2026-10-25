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

      if (
        first != null &&
        (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))
      ) {
        uses.push({
          line: file.getLineAndCharacterOfPosition(first.getStart(file)).line + 1,
          key: first.text,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(file, visit);

  return uses;
}

function isTranslator(callee: ts.Expression): boolean {
  if (ts.isIdentifier(callee)) return callee.text === 't';

  return ts.isPropertyAccessExpression(callee) && callee.name.text === 't';
}

/** A message, the base of a plural family, or a branch read whole. */
export function resolves(catalogue: Catalogue | readonly string[], key: string): boolean {
  const keys = Array.isArray(catalogue) ? catalogue : keysOf(catalogue);

  return keys.some(
    (each) =>
      each === key ||
      each.startsWith(`${key}.`) ||
      PLURAL_SUFFIXES.some((suffix) => each === `${key}${suffix}`),
  );
}

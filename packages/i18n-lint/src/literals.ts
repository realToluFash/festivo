/**
 * User-facing text written as a literal instead of going through `t()`.
 *
 * Parsed with TypeScript's own parser rather than matched with a regex, and
 * that is the whole design. The previous build's translation sweep used a
 * single-line pattern: it could not see prose WRAPPED across several lines of
 * markup, eleven untranslated strings passed every check, and they shipped.
 *
 * A parser does not have lines. A JSX text node spans however much of the file
 * it spans, so wrapped prose is the same node as prose on one line and there is
 * nothing to miss.
 *
 * It also removes the whole class of false positive a regex invites — `=>`,
 * `Array<string>` and a comparison all contain the characters a `>…<` pattern
 * looks for, and none of them is text.
 */
import ts from 'typescript';

import { USER_FACING_PROPS } from './surfaces.ts';

export interface Finding {
  line: number;
  text: string;
  reason: string;
}

/**
 * At least two consecutive letters somewhere.
 *
 * So `←`, `·`, `—`, `×`, `42`, `%` and `:` are not findings. They are
 * punctuation and decoration, identical in every language, and flagging them
 * trains people to add exemptions — which is how a guard stops being read.
 */
const PROSE = /\p{L}{2,}/u;

/** Components whose children are translation machinery, not text. */
const TRANSLATION_COMPONENTS = new Set(['Trans']);

export function findLiterals(fileName: string, source: string): Finding[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ESNext,
    true,
    scriptKind(fileName),
  );
  const findings: Finding[] = [];

  const lineOf = (node: ts.Node): number =>
    file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;

  const visit = (node: ts.Node): void => {
    // 1. Text sitting directly in markup: <Text>Save</Text>
    if (ts.isJsxText(node)) {
      const text = node.text.trim();

      if (PROSE.test(text) && !insideTranslationComponent(node)) {
        findings.push({
          line: lineOf(node),
          text: collapse(text),
          reason: 'text in markup',
        });
      }
    }

    // 2. A prop a person reads: placeholder="Search guests"
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text;

      if (USER_FACING_PROPS.includes(name)) {
        const literal = literalValueOf(node.initializer);

        if (literal != null && PROSE.test(literal)) {
          findings.push({
            line: lineOf(node),
            text: `${name}="${collapse(literal)}"`,
            reason: 'user-facing prop',
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(file, visit);

  return findings;
}

function scriptKind(fileName: string): ts.ScriptKind {
  return fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

/**
 * The literal behind an attribute value, or null when it is an expression.
 *
 * `placeholder={t('x')}` is correct and must not be flagged. A template with no
 * substitutions — `placeholder={`Search`}` — is a literal wearing backticks,
 * and is flagged.
 */
function literalValueOf(initializer: ts.JsxAttributeValue | undefined): string | null {
  if (initializer == null) return null;

  if (ts.isStringLiteral(initializer)) return initializer.text;

  if (ts.isJsxExpression(initializer) && initializer.expression != null) {
    const expression = initializer.expression;

    if (ts.isStringLiteral(expression)) return expression.text;
    if (ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
  }

  return null;
}

/** Inside a <Trans>, where the children ARE the translation. */
function insideTranslationComponent(node: ts.Node): boolean {
  for (let current = node.parent; current != null; current = current.parent) {
    if (!ts.isJsxElement(current)) continue;

    const tag = current.openingElement.tagName;
    if (ts.isIdentifier(tag) && TRANSLATION_COMPONENTS.has(tag.text)) return true;
  }

  return false;
}

/** One line, for a failure message. The point is to recognise it, not read it. */
function collapse(text: string): string {
  const single = text.replace(/\s+/g, ' ').trim();

  return single.length > 60 ? `${single.slice(0, 57)}…` : single;
}

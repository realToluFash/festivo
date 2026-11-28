import TOKENS from './tokens.css?raw';

type Declarations = ReadonlyMap<string, string>;

export function readSchemeBlocks(css: string): {
  base: Declarations;
  schemes: ReadonlyMap<string, Declarations>;
} {
  let base: Declarations = new Map();
  const schemes = new Map<string, Declarations>();

  for (const [, name, body] of css.matchAll(
    /:root(?:\[data-scheme='([a-z]+)'\])?\s*\{([^}]*)\}/g,
  )) {
    const declarations = new Map<string, string>();
    for (const [, property, value] of (body ?? '').matchAll(/(--[A-Za-z0-9]+)\s*:\s*([^;]+);/g)) {
      if (property != null && value != null) declarations.set(property, value.trim());
    }

    if (name == null) base = declarations;
    else schemes.set(name, declarations);
  }

  return { base, schemes };
}

const BLOCKS = readSchemeBlocks(TOKENS);
const VARYING = [...new Set([...BLOCKS.schemes.values()].flatMap((block) => [...block.keys()]))];

/** Every token a scheme sets, as that scheme has it: a name with no block has the base's. */
export function schemeTokens(name: string): ReadonlyMap<string, string> {
  const block = BLOCKS.schemes.get(name);
  const tokens = new Map<string, string>();

  for (const property of VARYING) {
    const value = block?.get(property) ?? BLOCKS.base.get(property);
    if (value != null) tokens.set(property, value);
  }

  return tokens;
}

/** Lays a scheme's tokens on one element, so it and what is inside it keep that scheme whatever the page is in. */
export function keepScheme(element: HTMLElement, name: string): void {
  for (const [property, value] of schemeTokens(name)) element.style.setProperty(property, value);
}

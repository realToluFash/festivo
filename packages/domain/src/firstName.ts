/** A person's name up to its first space; a name with no space is its own first name. */
export function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

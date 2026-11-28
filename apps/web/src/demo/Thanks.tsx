import './thanks.css';

/** sc-6476: the hosts' own words, never translated or linked, signed with the hosts' names. The guest's page and the host's Event View show this one line. */
export function Thanks({ line, hosts, small }: { line: string; hosts: string; small?: boolean }) {
  return (
    <figure className={small === true ? 'gp-thanks is-small' : 'gp-thanks'}>
      <blockquote dir="auto">{line}</blockquote>
      <figcaption>{hosts}</figcaption>
    </figure>
  );
}

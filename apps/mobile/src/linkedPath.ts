/** The app path a link opens, as the router reads it: a universal link's path, what follows an Expo Go link's `/--/`, or what follows the app's scheme. */
export function linkedPath(link: string): string {
  const web = /^https?:\/\/[^/?#]*(.*)$/i.exec(link);
  const expoGo = /^exps?:\/\//i.test(link)
    ? (/^exps?:\/\/.*?\/--\/(.*)$/i.exec(link)?.[1] ?? '')
    : undefined;
  const scheme = /^[a-z][a-z0-9+.-]*:\/\/(.*)$/i.exec(link);
  const path = web?.[1] ?? expoGo ?? scheme?.[1] ?? link;

  return path.startsWith('/') ? path : `/${path}`;
}
